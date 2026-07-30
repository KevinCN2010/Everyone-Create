import os
import json
import math
import time
import hmac
import html
import base64
import hashlib
import secrets
import threading
import fcntl
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse, quote, urljoin
import requests
from requests.exceptions import RequestException
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import Headers
from sqlalchemy import func, desc
from apscheduler.schedulers.background import BackgroundScheduler
from jinja2 import Environment, FileSystemLoader

# ── 启动前修正 sys.path：确保 backend 模块可导入（Docker 容器内工作目录为 /app） ──
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ── 从后端模块导入（消除冗余） ──
from backend.models.db import Base, engine, SessionLocal, Traffic, ReferrerTraffic, PathTraffic, RequestLog
from backend.services.token_manager import TokenManager, sanitize_log as _sanitize_log
from backend.services.cache import cached_get, clear_cache, get_github_headers, cache_stats
from backend.utils.helpers import decode_path as _decode_path

# ── 启动前编译检查：扫描 backend/ 下所有 .py 文件，失败不阻塞启动 ──
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from backend.app import run_startup_checks
    run_startup_checks()
except Exception as startup_err:
    print(f"[startup] 启动检查异常（不影响主程序启动）: {startup_err}")

REPOS = [r.strip() for r in os.getenv("REPOS", "").split(",") if r.strip()]
DISABLE_TRAFFIC = os.getenv("DISABLE_TRAFFIC", "").lower() in ("true", "1", "yes")

# ── Token 管理器（使用 backend/services/token_manager.py） ──
# 全局 Token 管理器实例
_token_manager = TokenManager()

# 同步初始化 backend/services/cache.py 中的 token 管理器引用
try:
    from backend.services.cache import init_token_manager as _init_cache_tm
    _init_cache_tm(_token_manager)
except Exception:
    pass


def _get_github_token():
    """返回剩余配额最多的 GitHub Token"""
    return _token_manager.get_best_token()


def _get_all_tokens():
    """返回所有 Token 列表（内部使用，非脱敏）"""
    return _token_manager.get_all_tokens()


# ── 应用启动时间戳，用于静态文件版本控制（更改时手动更新此值）──
_APP_STATIC_VERSION = 4

# ── Docs 身份令牌：用于验证文档请求来自真人访客 ──
DOCS_SECRET = secrets.token_hex(32)

def _generate_docs_token(file: str) -> str:
    """生成带时效的文档访问令牌（有效期 5 分钟）"""
    expiry = str(int(time.time()) + 300)
    msg = f"{file}:{expiry}"
    sig = hmac.new(DOCS_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{sig}.{expiry}".encode()).decode().rstrip("=")

def _verify_docs_token(token: str, file: str) -> bool:
    """验证文档访问令牌"""
    try:
        padded = token + "=" * (4 - len(token) % 4) if len(token) % 4 else token
        decoded = base64.urlsafe_b64decode(padded).decode()
        sig, expiry = decoded.rsplit(".", 1)
        expiry_int = int(expiry)
        if time.time() > expiry_int:
            return False
        expected = hmac.new(DOCS_SECRET.encode(), f"{file}:{expiry}".encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected)
    except (ValueError, Exception):
        return False

# ── 速率限制追踪（IP → 最后请求时间）──
_last_fetch = {}  # {ip: timestamp}
_last_fetch_lock = threading.Lock()

# ── 配置热重载锁（保护全局变量并发访问）──
_config_lock = threading.Lock()
# ── 重载互斥锁：防止 /reload-config 与 env watcher 并发 ──
_reload_lock = threading.Lock()

# ── fetch_and_store 互斥锁，防止调度器和手动触发并发执行 ──
_fetch_lock = threading.Lock()
_FETCH_PROCESS_LOCK = os.path.abspath("./data/fetch.lock")

# ── 请求日志追踪 ──
_request_log = []  # [{time, ip, endpoint, user_agent}]
_request_lock = threading.Lock()

# ── 手动添加的 Token（不持久化到 .env，仅内存中保持）──
_manual_tokens = {}  # {token: name}

def log_request(ip, endpoint, user_agent=""):
    """记录一次请求（持久化到数据库，避免容器重启丢失）"""
    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')
    entry = {
        "time": now_iso,
        "ip": ip,
        "endpoint": endpoint,
        "user_agent": (user_agent or "")[:100],
    }
    # 写入内存缓存（快速读取）
    with _request_lock:
        _request_log.append(entry)
        if len(_request_log) % 500 == 0:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%S.%f')
            _request_log[:] = [r for r in _request_log if r["time"] >= cutoff]
        if len(_request_log) > 50000:
            _request_log[:] = _request_log[-50000:]
    # 写入数据库（持久化，重启不丢失）
    db = None
    try:
        db = SessionLocal()
        db.add(RequestLog(
            time=now_iso,
            ip=ip,
            endpoint=endpoint,
            user_agent=(user_agent or "")[:100],
        ))
        db.commit()
    except Exception as e:
        print(f"[log_request] DB write failed: {e}")
    finally:
        if db is not None:
            db.close()


def _restore_request_log():
    """从数据库恢复请求日志到内存（容器重启后调用）"""
    db = None
    try:
        db = SessionLocal()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%dT%H:%M:%S.%f')
        db.query(RequestLog).filter(RequestLog.time < cutoff).delete(synchronize_session=False)
        db.commit()
        rows = db.query(RequestLog).filter(RequestLog.time >= cutoff).order_by(RequestLog.id).all()
        with _request_lock:
            _request_log.clear()
            for r in rows:
                _request_log.append({
                    "time": r.time,
                    "ip": r.ip,
                    "endpoint": r.endpoint,
                    "user_agent": r.user_agent or "",
                })
        print(f"[restore] 从数据库恢复了 {len(rows)} 条请求日志")
    except Exception as e:
        print(f"[restore] 恢复请求日志失败: {e}")
    finally:
        if db is not None:
            db.close()

def get_token_stats(granularity="hour"):
    """统计请求负载，支持三级粒度：minute / hour / day"""
    with _request_lock:
        logs = list(_request_log)
    now = datetime.now(timezone.utc)
    requests_per_minute = 120  # 与 HTTP 中间件的单 IP 速率上限一致

    if granularity == "minute":
        n = 60
        delta = timedelta(minutes=1)
        trunc = lambda dt: dt.replace(second=0, microsecond=0)
        label = "minute"
        base_quota = requests_per_minute
    elif granularity == "day":
        n = 30
        delta = timedelta(days=1)
        trunc = lambda dt: dt.replace(hour=0, minute=0, second=0, microsecond=0)
        label = "day"
        base_quota = requests_per_minute * 60 * 24
    else:
        n = 24
        delta = timedelta(hours=1)
        trunc = lambda dt: dt.replace(minute=0, second=0, microsecond=0)
        label = "hour"
        base_quota = requests_per_minute * 60

    periods = []
    for i in range(n):
        period_start = trunc(now) - delta * i
        period_end = period_start + delta
        period_start_str = period_start.strftime('%Y-%m-%dT%H:%M:%S.%f')
        period_end_str = period_end.strftime('%Y-%m-%dT%H:%M:%S.%f')
        period_logs = [r for r in logs if period_start_str <= r["time"] < period_end_str]
        count = len(period_logs)
        ips = set(r["ip"] for r in period_logs)
        # 负载颜色: 绿色 < 30%, 黄色 30-70%, 红色 > 70%
        ratio = count / base_quota if base_quota > 0 else 0
        if ratio < 0.3:
            color = "#3fb950"  # 绿
        elif ratio < 0.7:
            color = "#ff8c42"  # 黄
        else:
            color = "#f85149"  # 红
        periods.append({
            "hour": period_start.isoformat(),
            "count": count,
            "unique_ips": len(ips),
            "ratio": round(ratio * 100, 1),
            "color": color,
        })
    periods.reverse()  # 从早到晚排列
    window_start = (trunc(now) - delta * (n - 1)).strftime('%Y-%m-%dT%H:%M:%S.%f')
    window_end = (trunc(now) + delta).strftime('%Y-%m-%dT%H:%M:%S.%f')
    window_logs = [r for r in logs if window_start <= r["time"] < window_end]
    total_ips = set(r["ip"] for r in window_logs)
    return {
        "total_requests": len(window_logs),
        "total_unique_ips": len(total_ips),
        "granularity": label,
        "hours": periods,
    }

def fetch_and_store():
    """定时抓取 GitHub Traffic API 数据并存入 SQLite（线程/进程互斥）。"""
    if not _fetch_lock.acquire(blocking=False):
        print("[fetch_and_store] 上一次抓取尚未完成，跳过本次执行")
        return
    lock_fd = None
    try:
        os.makedirs(os.path.dirname(_FETCH_PROCESS_LOCK), exist_ok=True)
        lock_fd = os.open(_FETCH_PROCESS_LOCK, os.O_CREAT | os.O_RDWR, 0o600)
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("[fetch_and_store] 其他进程正在抓取，跳过本次执行")
            return
        _do_fetch_and_store()
    finally:
        if lock_fd is not None:
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_UN)
            finally:
                os.close(lock_fd)
        _fetch_lock.release()

def _fetch_traffic_data(repo):
    """并行获取仓库流量数据（clones, views, referrers, paths）"""
    encoded_repo = "/".join(quote(part, safe="") for part in repo.split("/"))
    urls = {
        "clones": f"https://api.github.com/repos/{encoded_repo}/traffic/clones",
        "views": f"https://api.github.com/repos/{encoded_repo}/traffic/views",
        "referrers": f"https://api.github.com/repos/{encoded_repo}/traffic/popular/referrers",
        "paths": f"https://api.github.com/repos/{encoded_repo}/traffic/popular/paths",
    }
    results = {"clones": None, "views": None, "referrers": None, "paths": None}

    def _fetch_one(key, url):
        try:
            resp = requests.get(url, headers=get_github_headers(), timeout=30)
            if resp.ok:
                return key, resp.json()
        except (ValueError, RequestException) as e:
            print(f"[{repo}] {key} error: {e}")
        return key, None

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(_fetch_one, key, url): key for key, url in urls.items()}
        for future in as_completed(futures):
            key, data = future.result()
            results[key] = data

    return (results["clones"], results["views"], results["referrers"], results["paths"])


def _store_clones_data(db, repo, clones_data, views_data):
    """存储克隆/浏览数据（不提交，由调用方统一提交）"""
    clones = clones_data.get("clones", []) if isinstance(clones_data, dict) else []
    views = views_data.get("views", []) if isinstance(views_data, dict) else []
    if not clones and not views:
        print(f"Skipping traffic store for {repo} because GitHub traffic API returned no data.")
        return

    def by_date(items):
        result = {}
        for item in items:
            timestamp = item.get("timestamp")
            if timestamp:
                result[datetime.fromisoformat(timestamp.replace("Z", "+00:00")).date()] = item
        return result

    clones_by_date = by_date(clones)
    views_by_date = by_date(views)
    for date in sorted(set(clones_by_date) | set(views_by_date)):
        row = db.query(Traffic).filter_by(repo=repo, date=date).first()
        if row is None:
            row = Traffic(repo=repo, date=date, clones=0, unique_clones=0, views=0, unique_views=0)
            db.add(row)
        clone = clones_by_date.get(date)
        view = views_by_date.get(date)
        if clone is not None:
            row.clones = clone.get("count", 0)
            row.unique_clones = clone.get("uniques", 0)
        if view is not None:
            row.views = view.get("count", 0)
            row.unique_views = view.get("uniques", 0)
        print(f"Stored {repo} {date}: clones={row.clones}, views={row.views}")


def _store_referrer_paths(db, repo, fetch_date, referrers_data, paths_data):
    """存储来源/路径数据（不提交，由调用方统一提交）"""
    referrers = (referrers_data if isinstance(referrers_data, list)
                 else referrers_data.get("referrers", []) if isinstance(referrers_data, dict) else [])
    paths = (paths_data if isinstance(paths_data, list)
             else paths_data.get("paths", []) if isinstance(paths_data, dict) else [])
    if not db.query(ReferrerTraffic).filter_by(repo=repo, date=fetch_date).first():
        for r in referrers:
            db.add(ReferrerTraffic(repo=repo, date=fetch_date,
                                   referrer=r.get("referrer"), count=r.get("count", 0),
                                   uniques=r.get("uniques", 0)))
    if not db.query(PathTraffic).filter_by(repo=repo, date=fetch_date).first():
        for p in paths:
            db.add(PathTraffic(repo=repo, date=fetch_date,
                               path=p.get("path"), count=p.get("count", 0),
                               uniques=p.get("uniques", 0)))


def _do_fetch_and_store():
    if DISABLE_TRAFFIC:
        print("[DISABLE_TRAFFIC=true] 流量统计已禁用，跳过 GitHub Traffic API 调用")
        return
    db = None
    try:
        db = SessionLocal()
    except Exception as e:
        print(f"[fetch_and_store] Failed to create DB session: {e}")
        return
    try:
        for repo in REPOS:
            clones_data, views_data, referrers_data, paths_data = _fetch_traffic_data(repo)
            if all(v is None for v in (clones_data, views_data, referrers_data, paths_data)):
                continue
            print(f"[{repo}] Clones: {'OK' if clones_data else 'FAIL'}, Views: {'OK' if views_data else 'FAIL'}, "
                  f"Referrers: {'OK' if referrers_data else 'FAIL'}, Paths: {'OK' if paths_data else 'FAIL'}")
            try:
                _store_clones_data(db, repo, clones_data, views_data)
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"Error storing clones/views for {repo}: {e}")
            try:
                _store_referrer_paths(db, repo, datetime.now(timezone.utc).date(), referrers_data, paths_data)
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"Error storing referrers/paths for {repo}: {e}")
    finally:
        if db is not None:
            db.close()

# ── 调度器 ──
def _positive_int_env(name, default):
    try:
        value = int(os.getenv(name, str(default)))
        if value > 0:
            return value
    except (TypeError, ValueError):
        pass
    print(f"[config] {name} 必须是正整数，使用默认值 {default}")
    return default


UPDATE_HOURS = _positive_int_env("UPDATE_HOURS", 24)
scheduler = BackgroundScheduler()
scheduler.add_job(fetch_and_store, "interval", hours=UPDATE_HOURS, id="fetch_and_store")
# 定时刷新所有 Token 的速率限制信息（每 2 分钟）
scheduler.add_job(_token_manager.refresh_rate_limits, "interval", minutes=2, id="refresh_rate_limits")

# 启动时立即刷新一次 Token 速率限制（延迟 3 秒）
scheduler.add_job(_token_manager.refresh_rate_limits, "date",
                  run_date=datetime.now(timezone.utc) + timedelta(seconds=3))
# 启动后立即抓取一次数据（延迟 5 秒，不阻塞启动）
scheduler.add_job(fetch_and_store, "date",
                  run_date=datetime.now(timezone.utc) + timedelta(seconds=5))

scheduler.start()

# 从数据库恢复请求日志到内存（容器重启后数据不丢失）
_restore_request_log()

# ── .env 文件热重载 ──
# 尝试多个可能的路径（本地开发 + Docker 环境），优先使用 secrets/ 隔离目录
_DOT_ENV_CANDIDATES = lambda: [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'secrets', '.env'),  # /root/gitaap/secrets/.env (优先)
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'),              # /root/gitaap/.env
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'),                    # /root/gitaap/i18n/.env
    '/app/.env',                                                                          # Docker: /app/.env
    '/app/secrets/.env',                                                                  # Docker: /app/secrets/.env
    os.path.join(os.getcwd(), '.env'),                                                    # 当前工作目录（动态获取）
]
_DOT_ENV_PATH = None
_env_last_content = ''
_env_managed_keys = set()
_env_original_values = {}

def _find_dotenv():
    """查找第一个存在的 .env 文件路径"""
    global _DOT_ENV_PATH
    for p in _DOT_ENV_CANDIDATES():
        if os.path.exists(p):
            _DOT_ENV_PATH = p
            print(f"[hot-reload] 使用 .env 文件: {p}")
            return True
    _DOT_ENV_PATH = None
    print(f"[hot-reload] 警告: 未找到 .env 文件（尝试路径: {_DOT_ENV_CANDIDATES()}）")
    return False

def _apply_env_snapshot(values):
    """完整应用 .env 快照；删除的键恢复为进程启动时的值。"""
    global _env_managed_keys
    for key in _env_managed_keys - set(values):
        original = _env_original_values.get(key)
        if original is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = original
    for key, value in values.items():
        if key not in _env_original_values:
            _env_original_values[key] = os.environ.get(key)
        os.environ[key] = value
    _env_managed_keys = set(values)


def _load_dotenv(force=False):
    """手动解析 .env 文件并以完整快照更新 os.environ。"""
    global _env_last_content, _DOT_ENV_PATH
    if _DOT_ENV_PATH is None or not os.path.exists(_DOT_ENV_PATH):
        _DOT_ENV_PATH = None
        if not _find_dotenv():
            had_values = bool(_env_managed_keys)
            _apply_env_snapshot({})
            _env_last_content = ''
            return had_values
    try:
        with open(_DOT_ENV_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        # 计算哈希判断是否变化（忽略空行和注释变更）
        sig_lines = [l.strip() for l in content.splitlines() if l.strip() and not l.strip().startswith('#')]
        sig = hashlib.md5('\n'.join(sig_lines).encode()).hexdigest()
        if sig == _env_last_content and not force:
            return False
        values = {}
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            else:
                comment_idx = value.find(' #')
                if comment_idx >= 0:
                    value = value[:comment_idx].strip()
            if key:
                values[key] = value
        _apply_env_snapshot(values)
        _env_last_content = sig
        return True
    except (FileNotFoundError, OSError):
        _DOT_ENV_PATH = None
        return False


def _write_dotenv_key(key, value):
    """将指定 key=value 写入 .env 文件（替换已有或追加在末尾）。"""
    global _DOT_ENV_PATH
    if _DOT_ENV_PATH is None or not os.path.exists(_DOT_ENV_PATH):
        if not _find_dotenv():
            print(f"[dotenv] 未找到 .env 文件，无法写入 {key}")
            return False
    try:
        with open(_DOT_ENV_PATH, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        # 查找已存在的 key 行并替换
        found = False
        new_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith('#') and '=' in stripped:
                existing_key = stripped.split('=', 1)[0].strip()
                if existing_key == key:
                    new_lines.append(f'{key}={value}\n')
                    found = True
                    continue
            new_lines.append(line)
        if not found:
            # 在最后一个非空行后追加（或文件末尾）
            new_lines.append(f'{key}={value}\n')
        with open(_DOT_ENV_PATH, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        # 重置哈希缓存使下次热重载检测到变更
        global _env_last_content
        _env_last_content = ''
        print(f"[dotenv] 已写入 {key}=... 到 {_DOT_ENV_PATH}")
        return True
    except (OSError, IOError) as e:
        print(f"[dotenv] 写入失败: {e}")
        return False

def _hot_reload_config(force=False):
    """检测 .env 文件变更并热重载配置，返回是否成功应用变更"""
    if not _reload_lock.acquire(blocking=False):
        return False  # 已有重载正在进行，跳过
    try:
        global REPOS, DISABLE_TRAFFIC, UPDATE_HOURS, _APP_STATIC_VERSION, ADMIN_PASSWORD
        if not _load_dotenv(force=force):
            return False  # 文件无变化或不存在
        changed = []
        with _config_lock:
            # 重载仓库列表
            new_repos = [r.strip() for r in os.getenv("REPOS", "").split(",") if r.strip()]
            if new_repos != REPOS:
                REPOS = new_repos
                changed.append(f"REPOS={REPOS}")
            # 重载流量开关
            new_disable = os.getenv("DISABLE_TRAFFIC", "").lower() in ("true", "1", "yes")
            if new_disable != DISABLE_TRAFFIC:
                DISABLE_TRAFFIC = new_disable
                changed.append(f"DISABLE_TRAFFIC={DISABLE_TRAFFIC}")
            # 重载更新间隔
            try:
                new_update_hours = _positive_int_env("UPDATE_HOURS", UPDATE_HOURS)
                if new_update_hours != UPDATE_HOURS and new_update_hours > 0:
                    UPDATE_HOURS = new_update_hours
                    scheduler.reschedule_job("fetch_and_store", trigger="interval", hours=UPDATE_HOURS)
                    changed.append(f"UPDATE_HOURS={UPDATE_HOURS}")
            except (ValueError, TypeError):
                pass
            # 重载 Token（内部会读取 GITHUB_TOKENS / GITHUB_TOKEN 环境变量）
            old_tokens = _token_manager.get_all_tokens()
            _token_manager.reload_tokens(manual_tokens=_manual_tokens)
            new_tokens = _token_manager.get_all_tokens()
            if old_tokens != new_tokens:
                clear_cache()
                changed.append("GITHUB_TOKENS/GITHUB_TOKEN")
            new_admin_password = os.getenv("ADMIN_PASSWORD", _DEFAULT_ADMIN_PW)
            if new_admin_password != ADMIN_PASSWORD:
                ADMIN_PASSWORD = new_admin_password
                with _ADMIN_SESSION_LOCK:
                    ADMIN_SESSION.clear()
                changed.append("ADMIN_PASSWORD")
            if changed:
                _APP_STATIC_VERSION += 1
                print(f"[hot-reload] .env 变更已热重载: {'; '.join(changed)} (v{_APP_STATIC_VERSION})")
        return True
    finally:
        _reload_lock.release()

def _start_env_watcher():
    """启动 .env 文件变更检测守护线程（每 30 秒检查一次）"""
    def _watch():
        while True:
            try:
                _hot_reload_config()
            except Exception as e:
                print(f"[hot-reload] 检测异常: {e}")
            time.sleep(30)
    t = threading.Thread(target=_watch, daemon=True, name="env-watcher")
    t.start()


# ── CSRF 校验公共函数 ──

_CSRF_TOKENS: dict[str, dict] = {}
_CSRF_TOKEN_LOCK = threading.Lock()
_CSRF_TOKEN_MAX_AGE = 7200


def _generate_csrf_token() -> str:
    """生成 CSRF 令牌并存储（有效期 2 小时）"""
    now = time.time()
    token = secrets.token_hex(32)
    with _CSRF_TOKEN_LOCK:
        _CSRF_TOKENS[token] = {"created": now}
        expired = [t for t, v in _CSRF_TOKENS.items() if now - v["created"] > _CSRF_TOKEN_MAX_AGE]
        for t in expired:
            del _CSRF_TOKENS[t]
        if len(_CSRF_TOKENS) > 10000:
            oldest = sorted(_CSRF_TOKENS.keys(), key=lambda k: _CSRF_TOKENS[k]["created"])[:2000]
            for t in oldest:
                del _CSRF_TOKENS[t]
    return token


def _verify_csrf_token(token: str) -> bool:
    """验证 CSRF 令牌"""
    now = time.time()
    with _CSRF_TOKEN_LOCK:
        info = _CSRF_TOKENS.get(token)
        if info and now - info["created"] <= _CSRF_TOKEN_MAX_AGE:
            return True
        _CSRF_TOKENS.pop(token, None)
    return False


def _check_csrf(request: Request):
    """CSRF 保护：双重校验 Origin/Referer 头 + 自定义 CSRF Token，防止跨站请求伪造"""
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if not origin:
        raise HTTPException(status_code=403, detail="Missing Origin/Referer header")

    try:
        parsed = urlparse(origin)
        hostname = parsed.hostname or ""
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid origin")

    allowed = os.getenv("CSRF_ALLOWED_HOSTS", "localhost,127.0.0.1,github.www.eocc.top")
    allowed_hosts = [h.strip() for h in allowed.split(",") if h.strip()]

    if hostname not in allowed_hosts:
        raise HTTPException(status_code=403, detail="Forbidden")

    csrf_token = request.headers.get("X-CSRF-Token", "")
    if not csrf_token or not _verify_csrf_token(csrf_token):
        raise HTTPException(status_code=403, detail="Missing or invalid CSRF token")


app = FastAPI(docs_url=None, redoc_url=None)

@app.on_event("startup")
def recalc_plugin_sizes():
    """启动时重新计算所有插件大小，避免 registry.json 中硬编码值过期。

    实际写入委托给 _sync_plugin_sizes()：它在 _PLUGIN_REGISTRY_LOCK 内完成
    读-改-写，并用临时文件 + os.replace 原子替换，避免与运行中的
    /plugins/toggle 写入竞争导致 registry.json 被截断。
    """
    _sync_plugin_sizes()

@app.on_event("shutdown")
def shutdown_scheduler():
    """应用关闭时优雅停止调度器和清理线程"""
    scheduler.shutdown(wait=False)
    _cleanup_event.set()  # 通知清理线程退出

# ── 自定义静态文件服务：添加长效 Cache-Control 头 ──

class CachedStaticFiles(StaticFiles):
    """
    静态文件缓存策略：
    - 使用 no-cache, must-revalidate → 浏览器每次都向服务器校验
    - Starlette 自动附加 ETag + Last-Modified（基于文件 mtime/size）
    - 文件未变 → 服务器返回 304 Not Modified（无内容体，极快）
    - 文件已变 → 服务器返回 200 + 最新内容
    - 兼顾"永远最新"和"低带宽消耗"
    """
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
        return response

app.mount("/static", CachedStaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

templates = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")), autoescape=True)

@app.get("/csrf-token")
def get_csrf_token(request: Request):
    """获取 CSRF 令牌供前端使用（检查 Origin/Referer，无头时不拒绝）"""
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if origin:
        try:
            parsed = urlparse(origin)
            hostname = parsed.hostname or ""
            allowed = os.getenv("CSRF_ALLOWED_HOSTS", "localhost,127.0.0.1,github.www.eocc.top")
            allowed_hosts = [h.strip() for h in allowed.split(",") if h.strip()]
            if hostname not in allowed_hosts:
                raise HTTPException(status_code=403, detail="Forbidden")
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid origin")
    return {"token": _generate_csrf_token()}

# ── 速率限制 ──
# 原先页面与数据接口共用 120 次/分钟，但仪表盘等页面单次加载就会并发发出
# 数十个数据请求（仓库信息、流量、提交、语言、发布…），正常浏览两三个页面
# 即可打满配额并被判超频，因此这里放宽额度，并把「页面导航」与「数据接口」
# 分成两个独立配额：页面导航次数天然很少，数据接口才是高频来源。
def _env_int(name: str, default: int, minimum: int = 1) -> int:
    """读取整型环境变量；非法值回退默认，避免配置写错直接把服务卡死。"""
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        print(f"[rate-limit] {name}={raw!r} 不是整数，回退默认值 {default}")
        return default
    if value < minimum:
        print(f"[rate-limit] {name}={value} 小于下限 {minimum}，回退默认值 {default}")
        return default
    return value


_RATE_LIMIT_WINDOW = _env_int("RATE_LIMIT_WINDOW", 60)   # 窗口大小（秒）
_RATE_LIMIT_MAX = _env_int("RATE_LIMIT_MAX", 1800)       # 数据接口：窗口内最大请求数
_RATE_LIMIT_PAGE_MAX = _env_int("RATE_LIMIT_PAGE_MAX", 240)  # 页面导航：窗口内最大次数
# 短时突发额度：仪表盘/个人页首屏会在 1-2 秒内并发打出几十个数据请求，
# 单看长窗口均值远未超限，但瞬时并发容易被误判，故单独给一个更短的突发窗口。
# 个人页翻页、多仓库预加载都会叠加瞬时并发，额度按单 IP 放宽到 600/5s，
# 仍远低于长窗口均值上限，既挡得住脚本刷量又不误伤正常浏览。
_RATE_LIMIT_BURST_WINDOW = _env_int("RATE_LIMIT_BURST_WINDOW", 5)
_RATE_LIMIT_BURST_MAX = _env_int("RATE_LIMIT_BURST_MAX", 600)
_RATE_LIMIT_MAX_IPS = 5000     # 最多追踪的不同 IP 数

# 计数式滑动窗口：每个键只存「当前窗口起点 + 计数 + 上一窗口计数」，
# 而非每请求一个时间戳。放大额度后内存仍是 O(键数) 而非 O(请求数)。
# 结构：{(ip, kind): [window_start, count, prev_count, burst_start, burst_count]}
_rate_limit_buckets = {}
_rate_limit_lock = threading.Lock()


def _rate_limit_check(bucket_key, now: float, limit: int, burst_limit=None) -> tuple:
    """滑动窗口计数器：返回 (是否超限, 建议重试秒数)。

    用「上一窗口计数按重叠比例加权 + 当前窗口计数」近似滑动窗口，
    避免固定窗口边界处瞬间放行两倍额度，同时保持 O(1) 内存与耗时。
    `burst_limit` 为 None 表示不额外限制短时突发。
    调用方必须持有 _rate_limit_lock。
    """
    entry = _rate_limit_buckets.get(bucket_key)
    win = _RATE_LIMIT_WINDOW
    if entry is None:
        _rate_limit_buckets[bucket_key] = [now, 0, 0, now, 0]
        entry = _rate_limit_buckets[bucket_key]

    # 长窗口滚动
    elapsed = now - entry[0]
    if elapsed >= win * 2:
        entry[0], entry[1], entry[2] = now, 0, 0
    elif elapsed >= win:
        entry[0], entry[1], entry[2] = entry[0] + win, 0, entry[1]

    # 突发窗口滚动
    if now - entry[3] >= _RATE_LIMIT_BURST_WINDOW:
        entry[3], entry[4] = now, 0

    overlap = max(0.0, 1.0 - (now - entry[0]) / win) if win > 0 else 0.0
    weighted = entry[2] * overlap + entry[1]

    if weighted >= limit:
        return True, max(1, int(win - (now - entry[0])) + 1)
    if burst_limit is not None and entry[4] >= burst_limit:
        return True, max(1, int(_RATE_LIMIT_BURST_WINDOW - (now - entry[3])) + 1)

    entry[1] += 1
    entry[4] += 1
    return False, 0


def _is_page_request(request) -> bool:
    """判断是否为浏览器地址栏级别的页面导航请求（而非 fetch/XHR 数据请求）。

    浏览器导航会带 `Accept: text/html`，而前端 fetch 默认 `Accept: */*`；
    再排除显式声明的 XHR，避免把数据请求误判成页面。
    """
    accept = (request.headers.get("accept") or "").lower()
    if "text/html" not in accept:
        return False
    if (request.headers.get("x-requested-with") or "").lower() == "xmlhttprequest":
        return False
    return True

def _rate_limited_response(request, retry_after: int, is_page: bool) -> Response:
    """构造 429 响应：页面导航返回专用提醒页，数据请求返回 JSON。

    两者都带标准 `Retry-After` 头，便于浏览器与调用方判断冷却时间。
    """
    headers = {
        "Retry-After": str(retry_after),
        # 超频页面不应被缓存，否则冷却结束后仍可能命中缓存的 429
        "Cache-Control": "no-store",
    }
    if is_page:
        try:
            html = templates.get_template("rate-limited.html").render(
                retry_after=retry_after,
                static_version=_APP_STATIC_VERSION,
            )
            return Response(content=html, status_code=429,
                            media_type="text/html; charset=utf-8", headers=headers)
        except Exception as e:
            # 模板渲染失败不能让限流失效，退化为纯文本仍返回 429
            print(f"[rate-limit] 渲染 429 页面失败，降级为文本: {e}")
            return Response(
                content=f"429 Too Many Requests. Retry after {retry_after}s.",
                status_code=429, media_type="text/plain; charset=utf-8", headers=headers,
            )
    return Response(
        content=json.dumps({
            "error": "Rate limit exceeded. Try again later.",
            "retry_after": retry_after,
        }),
        status_code=429, media_type="application/json", headers=headers,
    )


@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    path = str(request.url.path)
    # 只限制 API 端点（静态文件除外；admin 同样受速率限制，防止暴力破解）
    if path.startswith("/static/"):
        return await call_next(request)

    ip = request.client.host if request.client else "unknown"
    now = time.time()
    is_page = _is_page_request(request)
    kind = "page" if is_page else "api"
    limit = _RATE_LIMIT_PAGE_MAX if is_page else _RATE_LIMIT_MAX
    # 突发桶只约束数据接口：页面导航本身次数少，再限突发只会误伤正常浏览
    burst_limit = None if is_page else _RATE_LIMIT_BURST_MAX
    bucket_key = (ip, kind)

    with _rate_limit_lock:
        # 键数超限时清理过期键；计数式结构无「空列表」概念，按窗口空闲判定
        if len(_rate_limit_buckets) > _RATE_LIMIT_MAX_IPS:
            stale_keys = [key for key, e in _rate_limit_buckets.items()
                          if now - e[0] >= _RATE_LIMIT_WINDOW * 2]
            if not stale_keys:
                _rate_limit_buckets.clear()
            else:
                for stale_key in stale_keys:
                    del _rate_limit_buckets[stale_key]
        over_limit, retry_after = _rate_limit_check(bucket_key, now, limit, burst_limit)

    if over_limit:
        return _rate_limited_response(request, retry_after, is_page)

    return await call_next(request)

# ── 请求日志中间件 ──
@app.middleware("http")
async def log_requests_middleware(request, call_next):
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    endpoint = str(request.url.path)
    # 只记录 API 调用（不记录静态文件）
    if not endpoint.startswith("/static") and endpoint != "/healthz":
        await run_in_threadpool(log_request, ip, endpoint, ua)
    response = await call_next(request)
    return response

# ── 缓存策略中间件：为不同路径设置 Cache-Control ──
@app.middleware("http")
async def cache_control_middleware(request, call_next):
    response = await call_next(request)
    path = str(request.url.path)

    # 静态文件已在 CachedStaticFiles 中处理，跳过
    if path.startswith("/static/"):
        return response

    # HTML 页面：短缓存 60 秒 + 安全响应头
    if response.headers.get("content-type", "").startswith("text/html"):
        response.headers["Cache-Control"] = "public, max-age=60"
        # CSP: 只允许同源 + CDN 脚本和内联样式
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self'; "
            "font-src 'self'; "
            "frame-ancestors 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # API 数据接口（JSON）：缓存 30 秒，减轻服务器压力
    elif response.headers.get("content-type", "").startswith("application/json"):
        # 流式响应（proxy）不强制缓存
        if response.headers.get("x-accel-buffering") != "no":
            response.headers["Cache-Control"] = "public, max-age=30"

    return response

def require_github_token():
    if not _get_github_token():
        raise HTTPException(status_code=401, detail="GITHUB_TOKEN or GITHUB_TOKENS is required to fetch GitHub traffic data.")


def get_repo_overviews():
    """获取仓库真实概览数据（星标/复刻/Issue/语言/最近发布），用于首页展示"""
    urls = [(repo, f"https://api.github.com/repos/{repo}",
             f"https://api.github.com/repos/{repo}/releases?per_page=1")
            for repo in REPOS]

    results = {}

    def _fetch(repo, info_url, release_url):
        info = cached_get(info_url)
        if info is None:
            return repo, {"repo": repo, "error": True}
        release = cached_get(release_url)
        latest_release = None
        if release and isinstance(release, list) and len(release) > 0:
            r = release[0]
            latest_release = {
                "tag": r.get("tag_name"),
                "name": r.get("name"),
                "date": r.get("published_at"),
            }
        return repo, {
            "repo": repo,
            "error": False,
            "name": info.get("name"),
            "description": info.get("description"),
            "language": info.get("language") or '—',
            "stars": info.get("stargazers_count", 0),
            "forks": info.get("forks_count", 0),
            "open_issues": info.get("open_issues_count", 0),
            "watchers": info.get("subscribers_count") if info.get("subscribers_count") is not None else info.get("watchers_count", 0),
            "license": (info.get("license") or {}).get("spdx_id") or '—',
            "default_branch": info.get("default_branch"),
            "latest_release": latest_release,
            "archived": info.get("archived", False),
        }

    with ThreadPoolExecutor(max_workers=len(urls) or 1) as pool:
        futures = {pool.submit(_fetch, repo, info_url, release_url): repo
                   for repo, info_url, release_url in urls}
        for future in as_completed(futures):
            repo, data = future.result()
            results[repo] = data

    return [results.get(r, {"repo": r, "error": True}) for r in REPOS]

def get_next_update_time():
    """返回 fetch_and_store 调度任务的下次执行时间"""
    job = scheduler.get_job("fetch_and_store")
    if job and job.next_run_time:
        return job.next_run_time.isoformat()
    return None


@app.get("/", response_class=HTMLResponse)
def index():
    return templates.get_template("index.html").render(
        repo_summaries=get_repo_overviews(),
        update_interval_hours=UPDATE_HOURS,
        next_update=get_next_update_time(),
        static_version=_APP_STATIC_VERSION
    )


@app.get("/healthz")
def healthcheck():
    return {"status": "ok"}


def get_repo_date_range(repo: str):
    if DISABLE_TRAFFIC:
        return None, None

    db = SessionLocal()
    try:
        first_date = db.query(func.min(Traffic.date)).filter(Traffic.repo == repo).scalar()
        latest_date = db.query(func.max(Traffic.date)).filter(Traffic.repo == repo).scalar()
        return first_date, latest_date
    finally:
        db.close()


def _require_configured_repo(repo):
    with _config_lock:
        allowed = repo in REPOS
    if not allowed:
        raise HTTPException(status_code=404, detail="Repository is not configured")


def _parse_date_range(start, end, max_days=3660):
    try:
        start_date = datetime.fromisoformat(start).date()
        end_date = datetime.fromisoformat(end).date()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end must be on or after start")
    if (end_date - start_date).days > max_days:
        raise HTTPException(status_code=400, detail=f"Date range cannot exceed {max_days} days")
    return start_date, end_date


@app.get("/repos", response_class=HTMLResponse)
def repos_index():
    """仓库列表页：展示当前支持的所有仓库，支持前端搜索与多字段排序。

    数据复用首页的 get_repo_overviews()，额外补充排序所需的规整字段
    （发布时间戳、采集日期范围），避免前端解析不一致。
    """
    overviews = get_repo_overviews()
    items = []
    for item in overviews:
        repo = item.get("repo", "")
        owner, _, short = repo.partition("/")
        entry = dict(item)
        entry["owner"] = owner
        entry["short_name"] = item.get("name") or short or repo
        # 排序用的发布时间戳：无发布或时间非法则置 0，保证排序稳定
        release_ts = 0.0
        latest_release = item.get("latest_release") or {}
        raw_date = latest_release.get("date")
        if raw_date:
            try:
                release_ts = datetime.fromisoformat(
                    str(raw_date).replace("Z", "+00:00")).timestamp()
            except (ValueError, TypeError):
                release_ts = 0.0
        entry["release_ts"] = release_ts
        entry["release_label"] = (latest_release.get("name")
                                  or latest_release.get("tag") or "")
        items.append(entry)

    healthy = [i for i in items if not i.get("error")]
    stats = {
        "total": len(items),
        "failed": len(items) - len(healthy),
        "stars": sum(int(i.get("stars") or 0) for i in healthy),
        "forks": sum(int(i.get("forks") or 0) for i in healthy),
        "issues": sum(int(i.get("open_issues") or 0) for i in healthy),
        "languages": len({i.get("language") for i in healthy
                          if i.get("language") and i.get("language") != "—"}),
    }
    languages = sorted({i.get("language") for i in healthy
                        if i.get("language") and i.get("language") != "—"},
                       key=str.lower)
    return templates.get_template("repos.html").render(
        repo_items=items,
        repo_stats=stats,
        repo_languages=languages,
        update_interval_hours=UPDATE_HOURS,
        next_update=get_next_update_time(),
        static_version=_APP_STATIC_VERSION,
    )


@app.get("/repo", response_class=HTMLResponse)
def repo_dashboard(repo: str = None):
    selected_repo = repo if repo in REPOS else (REPOS[0] if REPOS else "")
    first_date, latest_date = (None, None)
    if selected_repo:
        first_date, latest_date = get_repo_date_range(selected_repo)
    return templates.get_template("dashboard.html").render(
        repos=REPOS,
        selected_repo=selected_repo,
        has_github_token=bool(_get_github_token()),
        repo_first_date=str(first_date) if first_date else "",
        repo_latest_date=str(latest_date) if latest_date else "",
        static_version=_APP_STATIC_VERSION
    )

@app.get("/config")
def get_config():
    db = SessionLocal()
    try:
        repo_data = []
        for repo in REPOS:
            if DISABLE_TRAFFIC:
                repo_data.append({
                    "repo": repo,
                    "traffic_rows": 0,
                    "referrer_rows": 0,
                    "path_rows": 0,
                    "first_date": None,
                    "latest_date": None
                })
            else:
                traffic_count = db.query(func.count(Traffic.id)).filter(Traffic.repo == repo).scalar()
                referrer_count = db.query(func.count(ReferrerTraffic.id)).filter(ReferrerTraffic.repo == repo).scalar()
                path_count = db.query(func.count(PathTraffic.id)).filter(PathTraffic.repo == repo).scalar()
                first_date = db.query(func.min(Traffic.date)).filter(Traffic.repo == repo).scalar()
                latest_date = db.query(func.max(Traffic.date)).filter(Traffic.repo == repo).scalar()
                repo_data.append({
                    "repo": repo,
                    "traffic_rows": int(traffic_count or 0),
                    "referrer_rows": int(referrer_count or 0),
                    "path_rows": int(path_count or 0),
                    "first_date": str(first_date) if first_date else None,
                    "latest_date": str(latest_date) if latest_date else None
                })
        return {
            "repo_count": len(REPOS),
            "repos": REPOS,
            "has_github_token": bool(_get_github_token()),
            "repo_data": repo_data
        }
    finally:
        db.close()

@app.get("/data")
def get_data(repo: str, start: str, end: str):
    if DISABLE_TRAFFIC:
        return []

    _require_configured_repo(repo)
    start_date, end_date = _parse_date_range(start, end)

    db = SessionLocal()
    try:
        records = db.query(Traffic).filter(
            Traffic.repo == repo,
            Traffic.date >= start_date,
            Traffic.date <= end_date
        ).all()

        data_dict = {r.date: r for r in records}
        
        result = []
        current = start_date
        while current <= end_date:
            if current in data_dict:
                r = data_dict[current]
                result.append({
                    "date": str(r.date),
                    "clones": r.clones,
                    "unique_clones": r.unique_clones,
                    "views": r.views,
                    "unique_views": r.unique_views
                })
            else:
                result.append({
                    "date": str(current),
                    "clones": 0,
                    "unique_clones": 0,
                    "views": 0,
                    "unique_views": 0
                })
            current += timedelta(days=1)
        
        return result
    finally:
        db.close()

@app.get("/summary")
def get_summary(repo: str, start: str, end: str):
    if DISABLE_TRAFFIC:
        return {
            "range": {"clones": 0, "views": 0},
            "global": {"clones": 0, "views": 0},
            "first_date": None,
            "tracked_days": 0,
            "best_day": {"date": None, "clones": 0}
        }

    _require_configured_repo(repo)
    start_date, end_date = _parse_date_range(start, end)

    db = SessionLocal()
    try:
        range_totals = db.query(
            func.coalesce(func.sum(Traffic.clones), 0),
            func.coalesce(func.sum(Traffic.views), 0)
        ).filter(
            Traffic.repo == repo,
            Traffic.date >= start_date,
            Traffic.date <= end_date
        ).one()

        global_totals = db.query(
            func.coalesce(func.sum(Traffic.clones), 0),
            func.coalesce(func.sum(Traffic.views), 0)
        ).filter(Traffic.repo == repo).one()

        first_date = db.query(func.min(Traffic.date)).filter(Traffic.repo == repo).scalar()
        latest_date = db.query(func.max(Traffic.date)).filter(Traffic.repo == repo).scalar()
        best_day = db.query(Traffic.date, Traffic.clones).filter(
            Traffic.repo == repo
        ).order_by(desc(Traffic.clones)).first()

        tracked_days = 0
        if first_date and latest_date:
            tracked_days = (latest_date - first_date).days + 1

        return {
            "range": {
                "clones": int(range_totals[0]),
                "views": int(range_totals[1])
            },
            "global": {
                "clones": int(global_totals[0]),
                "views": int(global_totals[1])
            },
            "first_date": str(first_date) if first_date else None,
            "tracked_days": tracked_days,
            "best_day": {
                "date": str(best_day[0]) if best_day else None,
                "clones": int(best_day[1]) if best_day else 0
            }
        }
    finally:
        db.close()


def fetch_github_list(url):
    """获取 GitHub API 列表数据，使用 cached_get 缓存（TTL 300 秒）"""
    return cached_get(url, ttl=300)

@app.get("/referrers")
def get_referrers(repo: str, start: str = None, end: str = None):
    if DISABLE_TRAFFIC:
        return []

    _require_configured_repo(repo)
    if bool(start) != bool(end):
        raise HTTPException(status_code=400, detail="start and end must be provided together")
    db = SessionLocal()
    try:
        query = db.query(
            ReferrerTraffic.referrer,
            func.coalesce(func.sum(ReferrerTraffic.count), 0).label("count"),
            func.coalesce(func.sum(ReferrerTraffic.uniques), 0).label("uniques")
        ).filter(ReferrerTraffic.repo == repo)

        if start and end:
            start_date, end_date = _parse_date_range(start, end)
            query = query.filter(
                ReferrerTraffic.date >= start_date,
                ReferrerTraffic.date <= end_date
            )

        rows = query.group_by(ReferrerTraffic.referrer).order_by(desc("count")).all()
        if rows:
            return [
                {"referrer": r.referrer, "count": int(r.count), "uniques": int(r.uniques)}
                for r in rows
            ]

        # DB 无数据，从 GitHub API 获取（已由 fetch_github_list 缓存）
        require_github_token()
        url = f"https://api.github.com/repos/{repo}/traffic/popular/referrers"
        data = fetch_github_list(url)
        if data is None:
            raise HTTPException(status_code=502, detail="GitHub referrer fetch failed. Check GITHUB_TOKEN and repo permissions.")
        referrers = data if isinstance(data, list) else data.get("referrers", [])
        fetch_date = datetime.now(timezone.utc).date()
        if not db.query(ReferrerTraffic).filter_by(repo=repo, date=fetch_date).first():
            for r in referrers:
                db.add(ReferrerTraffic(
                    repo=repo, date=fetch_date,
                    referrer=r.get("referrer"),
                    count=r.get("count", 0),
                    uniques=r.get("uniques", 0)
                ))
            db.commit()
        return [
            {"referrer": r.get("referrer"), "count": r.get("count", 0), "uniques": r.get("uniques", 0)}
            for r in referrers
        ]
    finally:
        db.close()

@app.get("/popular-paths")
def get_popular_paths(repo: str, start: str = None, end: str = None):
    if DISABLE_TRAFFIC:
        return []

    _require_configured_repo(repo)
    if bool(start) != bool(end):
        raise HTTPException(status_code=400, detail="start and end must be provided together")
    db = SessionLocal()
    try:
        query = db.query(
            PathTraffic.path,
            func.coalesce(func.sum(PathTraffic.count), 0).label("count"),
            func.coalesce(func.sum(PathTraffic.uniques), 0).label("uniques")
        ).filter(PathTraffic.repo == repo)

        if start and end:
            start_date, end_date = _parse_date_range(start, end)
            query = query.filter(
                PathTraffic.date >= start_date,
                PathTraffic.date <= end_date
            )

        rows = query.group_by(PathTraffic.path).order_by(desc("count")).all()
        if rows:
            return [
                {"path": r.path, "count": int(r.count), "uniques": int(r.uniques)}
                for r in rows
            ]

        # DB 无数据，从 GitHub API 获取（已由 fetch_github_list 缓存）
        require_github_token()
        url = f"https://api.github.com/repos/{repo}/traffic/popular/paths"
        data = fetch_github_list(url)
        if data is None:
            raise HTTPException(status_code=502, detail="GitHub path fetch failed. Check GITHUB_TOKEN and repo permissions.")
        paths = data if isinstance(data, list) else data.get("paths", [])
        fetch_date = datetime.now(timezone.utc).date()
        if not db.query(PathTraffic).filter_by(repo=repo, date=fetch_date).first():
            for p in paths:
                db.add(PathTraffic(
                    repo=repo, date=fetch_date,
                    path=p.get("path"),
                    count=p.get("count", 0),
                    uniques=p.get("uniques", 0)
                ))
            db.commit()
        return [
            {"path": p.get("path"), "count": p.get("count", 0), "uniques": p.get("uniques", 0)}
            for p in paths
        ]
    finally:
        db.close()

# ────────── 公开 GitHub API (无需 push 权限) ──────────

@app.get("/repo-info")
def get_repo_info(repo: str):
    """获取仓库基本信息：描述、星标、分支、语言、主题标签等"""
    try:
        if not repo:
            return {}
        url = f"https://api.github.com/repos/{repo}"
        d = cached_get(url, ttl=120)
        if d is None:
            return {"error": "GitHub API 请求失败或超时", "repo": repo}
        return {
            "repo": repo,
            "name": d.get("name"),
            "description": d.get("description"),
            "language": d.get("language"),
            "topics": d.get("topics", []),
            "stars": d.get("stargazers_count", 0),
            "forks": d.get("forks_count", 0),
            "open_issues": d.get("open_issues_count", 0),
            "watchers": d.get("subscribers_count") if d.get("subscribers_count") is not None else d.get("watchers_count", 0),
            "license": (d.get("license") or {}).get("spdx_id"),
            "default_branch": d.get("default_branch"),
            "created_at": d.get("created_at"),
            "updated_at": d.get("updated_at"),
            "pushed_at": d.get("pushed_at"),
            "homepage": d.get("homepage"),
            "archived": d.get("archived", False),
            "disabled": d.get("disabled", False),
        }
    except Exception as e:
        print(f"[repo-info] 错误: {e}"); return {"error": "Failed to fetch repo info", "repo": repo}


@app.get("/repo-detail-list")
def get_repo_detail_list(repo: str, detail_type: str = "stargazers", filter_type: str = None,
                         list_type: str = Query(None, alias="type")):
    """获取 Star 或 Fork 用户列表（分页，最多返回 100 条，带缓存）"""
    # 兼容旧前端使用过的 filter_type/type 参数。
    if detail_type == "stargazers":
        detail_type = filter_type or list_type or detail_type
    if not repo or detail_type not in ("stargazers", "forks"):
        return {"error": "Invalid parameters", "list": []}

    if detail_type == "stargazers":
        # GitHub 于 2026 年 7 月起限制 Star 列表 API 仅限仓库管理员/协作者访问
        # 直接请求以获取具体的错误信息
        url = f"https://api.github.com/repos/{repo}/stargazers?per_page=100&page=1"
        try:
            resp = requests.get(url, headers=get_github_headers(), timeout=15)
            if resp.ok:
                data = resp.json()
                if isinstance(data, list):
                    result = [{"login": u.get("login", "?"), "avatar": u.get("avatar_url", ""), "html_url": u.get("html_url", "#")} for u in data]
                    return {"type": "stargazers", "repo": repo, "total": len(result), "list": result}
            else:
                # 返回 GitHub 的具体错误信息
                try:
                    err_data = resp.json()
                    msg = err_data.get("message", "")
                    if "not found" in msg.lower():
                        return {"error": "GitHub 于 2026 年 7 月起限制了 Star 列表的公开访问，仅仓库管理员和协作者可查看", "list": []}
                    return {"error": f"GitHub: {msg}", "list": []}
                except Exception:
                    return {"error": f"GitHub API {resp.status_code}", "list": []}
        except RequestException as e:
            return {"error": f"请求失败: {str(e)[:100]}", "list": []}
        except Exception as e:
            return {"error": f"处理异常: {str(e)[:100]}", "list": []}

    # forks 继续使用缓存
    url = f"https://api.github.com/repos/{repo}/forks?per_page=100&page=1"
    data = cached_get(url, ttl=600)
    if data is None:
        return {"error": "GitHub API 请求失败，请检查 Token 和网络", "list": []}
    if isinstance(data, dict) and "message" in data:
        return {"error": f"GitHub: {data['message']}", "list": []}
    if not isinstance(data, list):
        return {"error": "返回数据格式异常", "list": []}
    result = [{"login": u.get("owner", {}).get("login", "?"), "avatar": u.get("owner", {}).get("avatar_url", ""), "html_url": u.get("html_url", "#"), "full_name": u.get("full_name", "")} for u in data]
    return {"type": "forks", "repo": repo, "total": len(result), "list": result}


@app.get("/branches")
def get_branches(repo: str):
    """获取仓库所有分支列表"""
    try:
        if not repo:
            return []
        repo_info = cached_get(f"https://api.github.com/repos/{repo}")
        default_branch = repo_info.get("default_branch") if repo_info else None
        url = f"https://api.github.com/repos/{repo}/branches?per_page=100"
        data = cached_get(url)
        if data is None or not isinstance(data, list):
            return []
        return [{"name": b.get("name"), "default": b.get("name") == default_branch} for b in data]
    except Exception as e:
        print(f"[branches] 错误: {e}")
        return []


@app.get("/repo-languages")
def get_repo_languages(repo: str):
    """获取仓库语言占比"""
    try:
        if not repo:
            return {}
        url = f"https://api.github.com/repos/{repo}/languages"
        data = cached_get(url, ttl=300)
        if data is None or not isinstance(data, dict):
            return {}
        total = sum(data.values()) or 1
        result = []
        lang_colors = {
            "JavaScript": "#f1e05a", "TypeScript": "#3178c6", "Python": "#3572A5",
            "Java": "#b07219", "Go": "#00ADD8", "Rust": "#dea584",
            "C": "#555555", "C++": "#f34b7d", "C#": "#178600",
            "Ruby": "#701516", "PHP": "#4F5D95", "Swift": "#F05138",
            "Kotlin": "#A97BFF", "Scala": "#c22d40", "Dart": "#00B4AB",
            "Lua": "#000080", "Perl": "#0298c3", "Shell": "#89e051",
            "HTML": "#e34c26", "CSS": "#563d7c", "SCSS": "#c6538c",
            "Less": "#1d365d", "Vue": "#41b883", "Svelte": "#ff3e00",
            "Objective-C": "#438eff", "Groovy": "#4298b8", "Gradle": "#02303a",
            "TeX": "#3D6117", "F#": "#b845fc", "PowerShell": "#012456",
            "Batchfile": "#C1F12E", "Properties": "#e5c04b",
        }
        for lang, bytes_val in sorted(data.items(), key=lambda x: -x[1]):
            pct = round(bytes_val / total * 100, 1)
            result.append({
                "name": lang,
                "percentage": pct,
                "bytes": bytes_val,
                "color": lang_colors.get(lang, "#8b98a6"),
            })
        return result
    except Exception as e:
        print(f"[repo-languages] 错误: {e}")
        return []


@app.get("/releases")
def get_releases(repo: str, limit: int = Query(10, ge=1, le=100), page: int = Query(1, ge=1)):
    """获取最近 releases（支持分页）"""
    try:
        if not repo:
            return []
        url = f"https://api.github.com/repos/{repo}/releases?per_page={limit}&page={page}"
        data = fetch_github_list(url)
        if data is None or not isinstance(data, list):
            return []
        result = []
        for r in data:
            result.append({
                "tag_name": r.get("tag_name"),
                "name": r.get("name"),
                "prerelease": r.get("prerelease", False),
                "draft": r.get("draft", False),
                "published_at": r.get("published_at"),
                "html_url": r.get("html_url"),
                "body": (r.get("body") or "")[:500],
                "author": r.get("author", {}).get("login") if r.get("author") else None,
            })
        return result
    except Exception as e:
        print(f"[releases] 错误: {e}")
        return []
    
    
@app.get("/release-detail")
def get_release_detail(repo: str, tag: str):
    """获取单个 release 的完整详情（含 assets/源码包）"""
    if not repo or not tag:
        return {"error": "Missing required parameters: repo, tag"}
    url = f"https://api.github.com/repos/{repo}/releases/tags/{quote(tag, safe='')}"
    try:
        d = cached_get(url, ttl=600)
        if d is None or isinstance(d, dict) and "message" in d:
            return {"error": "Release not found or API error", "repo": repo, "tag": tag}
        assets = []
        for a in d.get("assets", []):
            asset_info = {
                "name": a.get("name"),
                "size": a.get("size", 0),
                "download_count": a.get("download_count", 0),
                "content_type": a.get("content_type"),
                "browser_download_url": a.get("browser_download_url"),
                "created_at": a.get("created_at"),
                "sha256": None,
            }
            assets.append(asset_info)
        return {
            "repo": repo,
            "tag_name": d.get("tag_name"),
            "name": d.get("name"),
            "prerelease": d.get("prerelease", False),
            "draft": d.get("draft", False),
            "published_at": d.get("published_at"),
            "html_url": d.get("html_url"),
            "body": d.get("body") or "",
            "author": d.get("author", {}).get("login") if d.get("author") else None,
            "zipball_url": d.get("zipball_url"),
            "tarball_url": d.get("tarball_url"),
            "assets": assets,
        }
    except RequestException as e:
        print(f"[release-detail] {e}"); return {"error": "Failed to fetch release details", "repo": repo, "tag": tag}


@app.get("/release", response_class=HTMLResponse)
def release_page(repo: str = None, tag: str = None):
    """渲染 release 详情页"""
    return templates.get_template("release-detail.html").render(
        repo=repo or "",
        tag=tag or "",
        has_github_token=bool(_get_github_token()),
        static_version=_APP_STATIC_VERSION
    )


# ────────── Pull Request 详情 API ──────────

@app.get("/pull-detail")
def get_pull_detail(repo: str, number: int = Query(..., ge=1)):
    """获取单个 PR 的完整详情（含 commits / files / reviews）"""
    if not repo or not number:
        return {"error": "Missing required parameters: repo, number"}
    pr = cached_get(f"https://api.github.com/repos/{repo}/pulls/{number}")
    if pr is None:
        return {"error": f"Failed to fetch PR #{number}"}
    commits = cached_get(f"https://api.github.com/repos/{repo}/pulls/{number}/commits?per_page=30")
    reviews = cached_get(f"https://api.github.com/repos/{repo}/pulls/{number}/reviews?per_page=30")
    return {
        **_parse_pr_basic(pr),
        "commits": _parse_pr_commits(commits),
        "files": _parse_pr_files(
            cached_get(f"https://api.github.com/repos/{repo}/pulls/{number}/files?per_page=30"),
            _fetch_pull_patches(repo, number),
        ),
        "reviews": _parse_pr_reviews(reviews),
    }


def _parse_pr_basic(pr):
    """提取 PR 基本信息"""
    return {
        "number": pr.get("number"), "title": pr.get("title"),
        "state": pr.get("state"), "body": pr.get("body") or "",
        "draft": pr.get("draft", False), "merged": pr.get("merged", False),
        "mergeable": pr.get("mergeable"),
        "merged_at": pr.get("merged_at"), "created_at": pr.get("created_at"),
        "updated_at": pr.get("updated_at"), "closed_at": pr.get("closed_at"),
        "html_url": pr.get("html_url"),
        "user": pr.get("user", {}).get("login") if pr.get("user") else None,
        "user_avatar": pr.get("user", {}).get("avatar_url") if pr.get("user") else None,
        "labels": [l.get("name") for l in (pr.get("labels") or [])],
        "base_ref": pr.get("base", {}).get("ref") if pr.get("base") else None,
        "base_repo": pr.get("base", {}).get("repo", {}).get("full_name") if pr.get("base") else None,
        "head_ref": pr.get("head", {}).get("ref") if pr.get("head") else None,
        "head_repo": pr.get("head", {}).get("repo", {}).get("full_name") if pr.get("head") else None,
        "additions": pr.get("additions", 0), "deletions": pr.get("deletions", 0),
        "changed_files": pr.get("changed_files", 0), "comments": pr.get("comments", 0),
        "review_comments": pr.get("review_comments", 0), "commits_count": pr.get("commits", 0),
        "assignees": [a.get("login") for a in (pr.get("assignees") or [])],
        "requested_reviewers": [r.get("login") for r in (pr.get("requested_reviewers") or [])],
    }


def _parse_pr_commits(commits):
    """解析 PR commits"""
    if not commits or not isinstance(commits, list):
        return []
    return [{"sha": c.get("sha", "")[:7],
             "message": (c.get("commit", {}).get("message") or "").split("\n")[0],
             "author": c.get("commit", {}).get("author", {}).get("name"),
             "date": c.get("commit", {}).get("author", {}).get("date")}
            for c in commits[:20]]


def _parse_pr_files(pr_files, full_patches):
    """解析 PR 文件变更"""
    if not pr_files or not isinstance(pr_files, list):
        return []
    return [{"filename": f.get("filename"), "status": f.get("status"),
             "additions": f.get("additions", 0), "deletions": f.get("deletions", 0),
             "changes": f.get("changes", 0),
             "patch": (full_patches.get(f.get("filename")) or f.get("patch") or "")[:100000],
             "blob_url": f.get("blob_url") or f.get("raw_url") or ""}
            for f in pr_files[:30]]


def _parse_pr_reviews(reviews):
    """解析 PR reviews"""
    if not reviews or not isinstance(reviews, list):
        return []
    return [{"user": r.get("user", {}).get("login") if r.get("user") else None,
             "state": r.get("state"),
             "body": (r.get("body") or "")[:500],
             "submitted_at": r.get("submitted_at")}
            for r in reviews[:20]]


_pull_patch_cache = {}
_pull_patch_lock = threading.Lock()


def _fetch_pull_patches(repo, number):
    """获取 raw diff 完整 patch（线程级缓存，避免重复请求）"""
    cache_key = f"{repo}:{number}"
    now = time.time()
    with _pull_patch_lock:
        entry = _pull_patch_cache.get(cache_key)
        if entry and now - entry[1] < 300:
            return dict(entry[0])

    full = {}
    try:
        headers = get_github_headers()
        headers["Accept"] = "application/vnd.github.v3.diff"
        resp = requests.get(f"https://api.github.com/repos/{repo}/pulls/{number}", headers=headers, timeout=30)
        try:
            if resp.ok:
                cf, cl = None, []
                for line in resp.text.split("\n"):
                    if line.startswith("diff --git "):
                        if cf is not None:
                            full[cf] = "\n".join(cl)
                        parts = line.split(" b/", 1)
                        cf = parts[1] if len(parts) > 1 else ""
                        cl = [line]
                    elif cf is not None:
                        cl.append(line)
                if cf is not None:
                    full[cf] = "\n".join(cl)
        finally:
            resp.close()
    except Exception as e:
        print(f"[pull-detail] raw diff fetch failed: {e}")

    with _pull_patch_lock:
        _pull_patch_cache[cache_key] = (full, now)
        if len(_pull_patch_cache) > 200:
            oldest_keys = sorted(_pull_patch_cache.keys(), key=lambda k: _pull_patch_cache[k][1])[:50]
            for k in oldest_keys:
                del _pull_patch_cache[k]
    return full



@app.get("/pull", response_class=HTMLResponse)
def pull_page(repo: str = None, number: int = None):
    """渲染 PR 详情页"""
    return templates.get_template("pull-detail.html").render(
        repo=repo or "",
        number=number or 0,
        has_github_token=bool(_get_github_token()),
        static_version=_APP_STATIC_VERSION
    )


# ────────── Commit 详情 API ──────────

@app.get("/commit-detail")
def get_commit_detail(repo: str, sha: str):
    """获取单个 commit 的完整详情（含文件变更、diff 统计）"""
    try:
        if not repo or not sha:
            return {"error": "repo and sha are required"}
        url = f"https://api.github.com/repos/{repo}/commits/{sha}"
        d = cached_get(url)
        if d is None:
            return {"error": f"Failed to fetch commit {sha}"}
        commit = d.get("commit", {})
        author = commit.get("author", {})
        result = {
            "sha": d.get("sha", ""),
            "short_sha": d.get("sha", "")[:7],
            "message": commit.get("message") or "",
            "author_name": author.get("name"),
            "author_email": author.get("email"),
            "author_username": d.get("author", {}).get("login") if d.get("author") else None,
            "author_avatar": d.get("author", {}).get("avatar_url") if d.get("author") else None,
            "date": author.get("date"),
            "html_url": d.get("html_url"),
            "committer_name": commit.get("committer", {}).get("name"),
            "committer_date": commit.get("committer", {}).get("date"),
            "stats": {
                "additions": d.get("stats", {}).get("additions", 0),
                "deletions": d.get("stats", {}).get("deletions", 0),
                "total": d.get("stats", {}).get("total", 0),
            },
        }
        files = d.get("files", [])
        if files:
            result["files"] = [{
                "filename": f.get("filename"),
                "status": f.get("status"),
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
                "changes": f.get("changes", 0),
                "patch": (f.get("patch") or "")[:5000],
            } for f in files[:30]]
        else:
            result["files"] = []
        return result
    except Exception as e:
        print(f"[commit-detail] 错误: {e}")
        return {"error": "Failed to fetch commit details"}


@app.get("/commit", response_class=HTMLResponse)
def commit_page(repo: str = None, sha: str = None):
    """渲染 commit 详情页"""
    return templates.get_template("commit-detail.html").render(
        repo=repo or "",
        sha=sha or "",
        has_github_token=bool(_get_github_token()),
        static_version=_APP_STATIC_VERSION
    )


@app.get("/issues")
def get_issues(repo: str, limit: int = Query(10, ge=1, le=100), page: int = Query(1, ge=1), state: str = "open"):
    """获取 issues（支持分页和状态筛选）"""
    try:
        if not repo:
            return []
        if state not in ("open", "closed", "all"):
            raise HTTPException(status_code=400, detail="state must be open, closed, or all")
        url = f"https://api.github.com/repos/{repo}/issues?state={state}&per_page={limit}&page={page}&sort=created&direction=desc&type=issue"
        data = fetch_github_list(url)
        if data is None or not isinstance(data, list):
            return []
        result = []
        for i in data:
            if i.get("pull_request"):
                continue
            result.append({
                "number": i.get("number"),
                "title": i.get("title"),
                "state": i.get("state"),
                "created_at": i.get("created_at"),
                "updated_at": i.get("updated_at"),
                "html_url": i.get("html_url"),
                "comments": i.get("comments", 0),
                "labels": [l.get("name") for l in (i.get("labels") or [])],
                "user": i.get("user", {}).get("login") if i.get("user") else None,
            })
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[issues] 错误: {e}")
        return []


# ────────── Issue 详情 API ──────────

@app.get("/issue-detail")
def get_issue_detail(repo: str, number: int = Query(..., ge=1)):
    """获取单个 Issue 的完整详情"""
    try:
        if not repo or not number:
            return {"error": "repo and number are required"}
        issue = cached_get(f"https://api.github.com/repos/{repo}/issues/{number}")
        if issue is None:
            return {"error": f"Failed to fetch issue #{number}"}
        comments = cached_get(f"https://api.github.com/repos/{repo}/issues/{number}/comments?per_page=50")
        result = {
            "number": issue.get("number"),
            "title": issue.get("title"),
            "state": issue.get("state"),
            "body": issue.get("body") or "",
            "created_at": issue.get("created_at"),
            "updated_at": issue.get("updated_at"),
            "closed_at": issue.get("closed_at"),
            "html_url": issue.get("html_url"),
            "user": issue.get("user", {}).get("login") if issue.get("user") else None,
            "user_avatar": issue.get("user", {}).get("avatar_url") if issue.get("user") else None,
            "labels": [{"name": l.get("name"), "color": l.get("color")} for l in (issue.get("labels") or [])],
            "assignees": [a.get("login") for a in (issue.get("assignees") or [])],
            "comments_count": issue.get("comments", 0),
            "locked": issue.get("locked", False),
            "reactions": issue.get("reactions", {}).get("total_count", 0) if issue.get("reactions") else 0,
        }
        if comments and isinstance(comments, list):
            result["comments"] = [{
                "user": c.get("user", {}).get("login") if c.get("user") else None,
                "user_avatar": c.get("user", {}).get("avatar_url") if c.get("user") else None,
                "body": c.get("body") or "",
                "created_at": c.get("created_at"),
                "updated_at": c.get("updated_at"),
                "reactions": c.get("reactions", {}).get("total_count", 0) if c.get("reactions") else 0,
            } for c in comments[:50]]
        else:
            result["comments"] = []
        return result
    except Exception as e:
        print(f"[issue-detail] 错误: {e}")
        return {"error": "获取 Issue 详情失败"}


# ────────── Issue 详情页 ──────────

@app.get("/issue", response_class=HTMLResponse)
def issue_page(repo: str = None, number: int = None):
    """渲染 Issue 详情页"""
    return templates.get_template("issue-detail.html").render(
        repo=repo or "",
        number=number or 0,
        has_github_token=bool(_get_github_token()),
        static_version=_APP_STATIC_VERSION
    )


@app.get("/pulls")
def get_pulls(repo: str, limit: int = Query(10, ge=1, le=100), page: int = Query(1, ge=1), state: str = "open"):
    """获取 pull requests（支持分页和状态筛选）"""
    try:
        if not repo:
            return []
        if state not in ("open", "closed", "all"):
            raise HTTPException(status_code=400, detail="state must be open, closed, or all")
        url = f"https://api.github.com/repos/{repo}/pulls?state={state}&per_page={limit}&page={page}&sort=created&direction=desc"
        data = fetch_github_list(url)
        if data is None or not isinstance(data, list):
            return []
        result = []
        for p in data:
            result.append({
                "number": p.get("number"),
                "title": p.get("title"),
                "state": p.get("state"),
                "created_at": p.get("created_at"),
                "updated_at": p.get("updated_at"),
                "html_url": p.get("html_url"),
                "draft": p.get("draft", False),
                "merged": p.get("merged", False),
                "user": p.get("user", {}).get("login") if p.get("user") else None,
                "labels": [l.get("name") for l in (p.get("labels") or [])],
            })
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"[pulls] 错误: {e}")
        return []


@app.get("/commits")
def get_commits(repo: str, limit: int = Query(10, ge=1, le=100), page: int = Query(1, ge=1)):
    """获取最近提交（支持分页）"""
    try:
        if not repo:
            return []
        url = f"https://api.github.com/repos/{repo}/commits?per_page={limit}&page={page}"
        data = fetch_github_list(url)
        if data is None or not isinstance(data, list):
            return []
        result = []
        for c in data:
            commit = c.get("commit", {})
            author = commit.get("author", {})
            result.append({
                "sha": c.get("sha", "")[:7],
                "message": (commit.get("message") or "").split("\n")[0],
                "author": author.get("name"),
                "date": author.get("date"),
                "html_url": c.get("html_url"),
            })
        return result
    except Exception as e:
        print(f"[commits] 错误: {e}")
        return []


# ────────── 仓库文件浏览 API ──────────

@app.get("/repo-tree")
def get_repo_tree(repo: str, path: str = "", ref: str = ""):
    """获取仓库目录树（指定路径下的文件和目录），支持分支参数"""
    try:
        if not repo:
            return []
        url = f"https://api.github.com/repos/{repo}/contents/{quote(path, safe='/')}"
        if ref:
            url += f"?ref={quote(ref, safe='')}"
        data = cached_get(url, ttl=600)
        if data is None:
            return []
        if isinstance(data, dict):
            return [{
                "name": data.get("name"),
                "path": data.get("path"),
                "type": data.get("type"),
                "size": data.get("size", 0),
                "download_url": data.get("download_url"),
            }]
        result = []
        for item in data:
            result.append({
                "name": item.get("name"),
                "path": item.get("path"),
                "type": item.get("type"),
                "size": item.get("size", 0) if item.get("type") == "file" else 0,
                "download_url": item.get("download_url"),
            })
        return result
    except Exception as e:
        print(f"[repo-tree] 错误: {e}")
        return []


# 高频中日韩汉字（含简繁常用字）：用于在 GB18030 与 Big5 之间判别真实编码。
# GB18030 几乎能解码任意字节串而不报错，若仅按顺序试解，Big5 文件会被
# 误判成 GB18030 并输出乱码（如「繁體中文測試」变成「羉砰いゅ代刚」），
# 因此这里改为「都解一遍再按中文合理度打分取优」。
_CJK_COMMON_CHARS = set(
    "的一是不了在人有我他这中大来上国个到说们为子和你地也时道出而要于就下得可"
    "年生自会那后能对着事其里所去行过家十用发天如然作方成者多日三小么心之现前"
    "面又定新看起分无同但们這國說時對會後來個過現麼無業產開關學實體灣臺總雖"
)
# 强错解信号：中文文本里出现假名/私用区/替换符，基本说明编码猜错了
_MISDECODE_RANGES = (
    (0x3040, 0x30FF),    # 平假名 / 片假名
    (0xE000, 0xF8FF),    # 私用区
    (0xFFFD, 0xFFFD),    # 替换符
)


def _score_text_plausibility(text: str) -> float:
    """给解码结果的「像不像正常中文/代码文本」打分，分越高越可信。"""
    score = 0.0
    for ch in text[:4000]:
        code = ord(ch)
        if ch in _CJK_COMMON_CHARS:
            score += 3.0
        elif 0x4E00 <= code <= 0x9FFF:
            score += 1.0
        elif ch.isascii():
            score += 0.3
        elif any(lo <= code <= hi for lo, hi in _MISDECODE_RANGES):
            score -= 4.0
    return score


def _decode_file_bytes(raw: bytes) -> tuple:
    """把仓库文件字节解码为可显示文本。

    返回 (文本, 编码名, 是否二进制)。UTF-8 严格解码成功即采用（最常见且无歧义）；
    失败时在 GB18030 与 Big5 之间按中文合理度打分选优，兼顾简体与繁体旧文件。
    """
    if not raw:
        return "", "utf-8", False

    # 含 NUL 字节基本可判定为二进制，不做文本解码，避免输出乱码
    if b"\x00" in raw[:8000] and not raw.startswith((b"\xff\xfe", b"\xfe\xff",
                                                     b"\xff\xfe\x00\x00", b"\x00\x00\xfe\xff")):
        return "", "binary", True

    # 带 BOM 的编码优先按 BOM 判定，并借 *-sig/UTF-16 解码顺带剥离 BOM
    for bom, codec in ((b"\xef\xbb\xbf", "utf-8-sig"),
                       (b"\xff\xfe\x00\x00", "utf-32"),
                       (b"\x00\x00\xfe\xff", "utf-32"),
                       (b"\xff\xfe", "utf-16"),
                       (b"\xfe\xff", "utf-16")):
        if raw.startswith(bom):
            try:
                return raw.decode(codec), codec, False
            except (UnicodeDecodeError, LookupError):
                break

    try:
        return raw.decode("utf-8"), "utf-8", False
    except UnicodeDecodeError:
        pass

    # 非 UTF-8：候选编码全解一遍，按合理度选最优，避免 GB18030 吞掉 Big5
    best = None
    for codec in ("gb18030", "big5", "shift_jis", "euc-kr"):
        try:
            text = raw.decode(codec)
        except (UnicodeDecodeError, LookupError):
            continue
        score = _score_text_plausibility(text)
        if best is None or score > best[0]:
            best = (score, text, codec)
    if best is not None:
        return best[1], best[2], False

    # 全部失败时用 Latin-1 保证不丢字节（可逆），标注真实编码为未知
    return raw.decode("latin-1"), "latin-1", False


@app.get("/file-content")
def get_file_content(repo: str, path: str, ref: str = ""):
    """获取文件内容（base64 解码），支持分支参数"""
    if not repo or not path:
        return {"error": "Missing required parameters: repo, path"}
    url = f"https://api.github.com/repos/{repo}/contents/{quote(path, safe='/')}"
    if ref:
        url += f"?ref={quote(ref, safe='')}"
    data = cached_get(url, ttl=600)
    if data is None:
        return {"error": "File not found or API error"}
    if not isinstance(data, dict):
        return {"error": "Path is not a file"}
    content = data.get("content", "")
    detected = "utf-8"
    is_binary = False
    if data.get("encoding") == "base64" and content:
        try:
            raw = base64.b64decode(content)
        except (ValueError, TypeError) as e:
            print(f"[file-content] base64 解码失败 {repo}/{path}: {e}")
            return {"error": "Unable to decode file content"}
        decoded, detected, is_binary = _decode_file_bytes(raw)
    else:
        decoded = content
    return {
        "name": data.get("name"),
        "path": data.get("path"),
        "size": data.get("size", 0),
        "sha": data.get("sha"),
        "content": decoded,
        "html_url": data.get("html_url"),
        "encoding": "text",
        # 前端据此提示真实编码 / 二进制文件，避免把乱码当正文渲染
        "detected_encoding": detected,
        "is_binary": is_binary,
    }


@app.get("/file", response_class=HTMLResponse)
def file_page(repo: str = None, path: str = None):
    """渲染文件内容查看页"""
    return templates.get_template("file-view.html").render(
        repo=repo or "",
        path=path or "",
        has_github_token=bool(_get_github_token()),
        static_version=_APP_STATIC_VERSION
    )


@app.get("/repo-mirror", response_class=HTMLResponse)
def repo_mirror(repo: str = None):
    """渲染仓库文件浏览镜像页（直接套用 dashboard.html 模板）"""
    import json
    selected = repo or ""
    # 让 repo 像正常的 dashboard 仓库一样展示，tab=browser 自动激活文件树
    return templates.get_template("dashboard.html").render(
        repos=[selected] if selected else [],
        selected_repo=selected,
        has_github_token=bool(_get_github_token()),
        repo_first_date="",
        repo_latest_date="",
        static_version=_APP_STATIC_VERSION
    )


# 用户仓库分页：默认每页条数与上限（GitHub 单页上限为 100）
_USER_REPOS_PER_PAGE = 24
_USER_REPOS_PER_PAGE_MAX = 100
_USER_REPOS_PAGE_MAX = 10000
_USER_REPOS_SORTS = {"updated", "pushed", "created", "full_name"}


def _serialize_user_repo(r: dict) -> dict:
    """把 GitHub 仓库对象裁剪为前端所需字段，减小响应体。"""
    return {
        "name": r.get("name"),
        "description": r.get("description"),
        "language": r.get("language"),
        "stars": r.get("stargazers_count", 0) or 0,
        "forks": r.get("forks_count", 0) or 0,
        "updated_at": r.get("updated_at", ""),
        "pushed_at": r.get("pushed_at", ""),
        "created_at": r.get("created_at", ""),
        "html_url": r.get("html_url", ""),
        "fork": r.get("fork", False),
        "archived": r.get("archived", False),
        "disabled": r.get("disabled", False),
        "visibility": r.get("visibility", "public"),
        "topics": r.get("topics", []),
        "license": (r.get("license") or {}).get("spdx_id"),
        "open_issues_count": r.get("open_issues_count", 0),
    }


def _fetch_user_repo_page(username: str, page: int, per_page: int, sort: str) -> dict:
    """按页拉取用户仓库（单次 GitHub 请求）。

    过去一次性循环最多 100 页（上万仓库）才能渲染页面，仓库多的用户会瞬间
    打满 GitHub 配额并拖慢首屏；现在改为「按需取一页」，翻页才发新请求。
    """
    repos_url = (
        f"https://api.github.com/users/{quote(username, safe='')}/repos"
        f"?per_page={per_page}&sort={sort}&type=owner&page={page}"
    )
    page_data = cached_get(repos_url, ttl=120)
    if page_data is None or not isinstance(page_data, list):
        raise HTTPException(status_code=502, detail="Unable to fetch user repositories")

    repos = [_serialize_user_repo(r) for r in page_data]
    page_owned = [r for r in repos if not r["fork"]]
    return {
        "repos": repos,
        "page": page,
        "per_page": per_page,
        "sort": sort,
        "count": len(repos),
        # 满页即认为还有下一页：不依赖 public_repos，避免其含 fork 口径差异导致误判
        "has_next": len(page_data) == per_page,
        "has_prev": page > 1,
        "page_owned_repos": len(page_owned),
        "page_forked_repos": len(repos) - len(page_owned),
        "page_owned_stars": sum(r["stars"] for r in page_owned),
        "page_owned_forks": sum(r["forks"] for r in page_owned),
    }


def _clamp_repo_paging(page: int, per_page: int, sort: str):
    """规整分页参数，避免非法值放大请求量或触发 GitHub 422。"""
    try:
        page = max(1, int(page))
    except (TypeError, ValueError):
        page = 1
    # page 也必须设上限：否则 page=10**9 会照样打一次 GitHub 请求换回空页，
    # 白耗上游配额。1 万页即便按最小每页 1 条也覆盖到第 1 万个仓库，足够真实场景。
    page = min(page, _USER_REPOS_PAGE_MAX)
    try:
        per_page = int(per_page)
    except (TypeError, ValueError):
        per_page = _USER_REPOS_PER_PAGE
    per_page = min(max(1, per_page), _USER_REPOS_PER_PAGE_MAX)
    if sort not in _USER_REPOS_SORTS:
        sort = "updated"
    return page, per_page, sort


@app.get("/user-info")
def get_user_info(user: str, page: int = 1, per_page: int = _USER_REPOS_PER_PAGE,
                  sort: str = "updated"):
    """获取 GitHub 用户资料 + 第一页公开自有仓库（分页增量，不再全量拉取）。"""
    username = (user or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="User parameter is required")
    page, per_page, sort = _clamp_repo_paging(page, per_page, sort)

    try:
        user_url = f"https://api.github.com/users/{quote(username, safe='')}"
        user_data = cached_get(user_url, ttl=120)
        if user_data is None:
            raise HTTPException(status_code=502, detail="GitHub API is unavailable")
        if user_data.get("message"):
            raise HTTPException(status_code=404, detail="User not found")

        public_repos = user_data.get("public_repos", 0) or 0
        page_info = _fetch_user_repo_page(username, page, per_page, sort)
        total_pages = max(1, math.ceil(public_repos / per_page)) if public_repos else 1
        return {
            "login": user_data.get("login"),
            "avatar_url": user_data.get("avatar_url"),
            "name": user_data.get("name") or user_data.get("login"),
            "bio": user_data.get("bio"),
            "company": user_data.get("company"),
            "location": user_data.get("location"),
            "blog": user_data.get("blog"),
            "twitter_username": user_data.get("twitter_username"),
            "type": user_data.get("type"),
            "hireable": user_data.get("hireable"),
            "public_repos": public_repos,
            "public_gists": user_data.get("public_gists", 0),
            "followers": user_data.get("followers", 0),
            "following": user_data.get("following", 0),
            "html_url": user_data.get("html_url"),
            "created_at": user_data.get("created_at", ""),
            "total_repos": public_repos,
            "total_pages": total_pages,
            # 统计口径：仅覆盖已加载的页，前端翻页时累加，避免为求总和全量拉取
            "stats_partial": page_info["has_next"] or page > 1,
            "loaded_repos": page_info["count"],
            "owned_stars_total": page_info["page_owned_stars"],
            "owned_forks_total": page_info["page_owned_forks"],
            "owned_repos": page_info["page_owned_repos"],
            "forked_repos": page_info["page_forked_repos"],
            **page_info,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[user-info] 错误: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch user info")


@app.get("/user-repos")
def get_user_repos(user: str, page: int = 1, per_page: int = _USER_REPOS_PER_PAGE,
                   sort: str = "updated"):
    """只返回某一页仓库（翻页用）：不重复下发用户资料，进一步减小请求与响应。"""
    username = (user or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="User parameter is required")
    page, per_page, sort = _clamp_repo_paging(page, per_page, sort)
    try:
        return _fetch_user_repo_page(username, page, per_page, sort)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[user-repos] 错误: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch user repositories")


@app.get("/user", response_class=HTMLResponse)
def user_page(user: str = ""):
    """渲染用户详情页"""
    return templates.get_template("user-detail.html").render(
        user=user,
        has_github_token=bool(_get_github_token()),
        static_version=_APP_STATIC_VERSION
    )


@app.get("/github-raw/{full_path:path}")
def github_raw_proxy(full_path: str, ref: str = ""):
    """代理 GitHub raw 内容（图片/文件），流式传输避免内存爆炸"""
    # full_path 格式: owner/repo/path/to/file
    parts = full_path.split("/", 2)
    if len(parts) < 3:
        raise HTTPException(status_code=400, detail="Invalid path format: owner/repo/path")
    owner_repo = f"{parts[0]}/{parts[1]}"
    file_path = parts[2]

    # 路径遍历防护：拒绝包含 .. 的路径（先 URL 解码，防止 %2e%2e 绕过）
    decoded_path = _decode_path(file_path)
    if ".." in decoded_path.split("/"):
        raise HTTPException(status_code=400, detail="Path traversal is not allowed")

    # 指定分支时不得静默回退到默认分支，否则会返回同路径的错误文件。
    branches_to_try = [ref] if ref else ["master", "main"]
    encoded_owner_repo = "/".join(quote(part, safe="") for part in owner_repo.split("/"))
    encoded_file_path = quote(file_path, safe="/")
    for branch in branches_to_try:
        url = f"https://raw.githubusercontent.com/{encoded_owner_repo}/{quote(branch, safe='')}/{encoded_file_path}"
        try:
            # raw.githubusercontent.com 不需要 GitHub Token
            resp = requests.get(url, timeout=30, stream=True)
            if resp.ok:
                content_type = resp.headers.get("content-type", "application/octet-stream")
                # 小文件直接返回，大文件流式传输
                content_length = resp.headers.get("content-length")
                if content_length and int(content_length) < 5 * 1024 * 1024:  # < 5MB
                    content = resp.content
                    resp.close()
                    return Response(content=content, media_type=content_type,
                                    headers={"Cache-Control": "public, max-age=3600"})
                response_headers = {"Cache-Control": "public, max-age=3600"}
                if content_length:
                    response_headers["Content-Length"] = content_length
                return StreamingResponse(
                    resp.iter_content(chunk_size=65536),
                    media_type=content_type,
                    headers=response_headers,
                    background=BackgroundTask(resp.close),
                )
            if resp.status_code == 401:
                resp.close()
                raise HTTPException(status_code=401, detail="GitHub authentication required to access this repository")
            if resp.status_code == 403:
                resp.close()
                raise HTTPException(status_code=403, detail="Access denied. This may be a private repository or rate limited")
            resp.close()
        except RequestException:
            continue
    detail = f"File not found on branch {ref}" if ref else "File not found on master or main branch"
    raise HTTPException(status_code=404, detail=detail)


# ── Mod 图标缓存目录 ──
_MOD_ICON_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "mod_icons")
_MOD_ICON_CACHE_TTL = 7 * 24 * 3600  # 7 天
_PLACEHOLDER_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">'
    '<rect width="64" height="64" rx="12" fill="var(--bg-dim,#1e2433)"/>'
    '<path d="M32 20c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 12c-4.4 0-8 1.8-8 4v2h16v-2c0-2.2-3.6-4-8-4z" fill="var(--text-dim,#8b98a6)"/>'
    '</svg>'
)


def _mod_icon_cache_path(author, repo):
    """返回本地缓存文件路径"""
    safe = hashlib.sha256(f"{author}/{repo}".encode()).hexdigest()[:16]
    return os.path.join(_MOD_ICON_CACHE_DIR, f"{safe}.png")


@app.get("/api/proxy/mod-icon")
def mod_icon_proxy_v2(author: str = "", repo: str = "", path: str = ""):
    """代理 Mod 图标，本地磁盘缓存7天。禁止浏览器直连 GitHub Raw。
    参数: author, repo, path (GET query)
    缩略图: author=owner&repo=name          → /master/icon.png
    高清大图: author=Anuken&repo=MindustryMods&path=icons/{name}.png
    """
    if not author or not repo:
        return Response(content=_PLACEHOLDER_SVG, media_type="image/svg+xml",
                        headers={"Cache-Control": "public, max-age=300"})

    file_path = path if path else "icon.png"

    # cache key 考虑 path 差异
    cache_path = _mod_icon_cache_path(author, repo + "/" + file_path)

    # 1) 本地缓存命中且未过期 → 直接返回
    if os.path.exists(cache_path):
        age = time.time() - os.path.getmtime(cache_path)
        if age < _MOD_ICON_CACHE_TTL:
            with open(cache_path, "rb") as f:
                return Response(content=f.read(), media_type="image/png",
                                headers={"Cache-Control": "public, max-age=604800", "X-Cache": "HIT"})

    # 2) 缓存不存在或过期 → 从 GitHub Raw 拉取
    branches_to_try = ["master", "main"]
    for branch in branches_to_try:
        url = f"https://raw.githubusercontent.com/{quote(author, safe='')}/{quote(repo, safe='')}/{quote(branch, safe='')}/icon.png"
        try:
            resp = requests.get(url, timeout=15)
            if resp.ok:
                content = resp.content
                resp.close()
                # 3) 保存到本地缓存
                os.makedirs(_MOD_ICON_CACHE_DIR, exist_ok=True)
                tmp = cache_path + ".tmp"
                with open(tmp, "wb") as f:
                    f.write(content)
                os.replace(tmp, cache_path)
                # 返回
                content_type = "image/png"
                return Response(content=content, media_type=content_type,
                                headers={"Cache-Control": "public, max-age=604800", "X-Cache": "MISS"})
            resp.close()
        except (RequestException, OSError):
            continue

    # 4) 拉取失败 → 返回占位SVG，不缓存
    return Response(content=_PLACEHOLDER_SVG, media_type="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=300"})


@app.get("/mod-icon")
def mod_icon_proxy(repo: str = "", ref: str = "master", path: str = ""):
    """代理 Mod 图标，7天浏览器缓存。禁止浏览器直连 GitHub Raw。
    缩略图: repo=owner/name → /master/icon.png
    高清大图: repo=Anuken/MindustryMods&path=icons/{name}.png
    """
    if not repo or "/" not in repo:
        raise HTTPException(status_code=400, detail="Invalid repo format: owner/name")
    owner_repo = "/".join(quote(part, safe="") for part in repo.split("/"))
    file_path = path if path else "icon.png"
    url = f"https://raw.githubusercontent.com/{owner_repo}/{quote(ref, safe='')}/{quote(file_path, safe='/')}"
    try:
        resp = requests.get(url, timeout=15, stream=True)
        if resp.ok:
            content_type = resp.headers.get("content-type", "image/png")
            content = resp.content
            resp.close()
            return Response(content=content, media_type=content_type,
                            headers={"Cache-Control": "public, max-age=604800", "X-Proxy": "gitaap"})
        resp.close()
        raise HTTPException(status_code=resp.status_code, detail="Icon not found")
    except RequestException as e:
        raise HTTPException(status_code=502, detail=f"Proxy failed: {e}")


def _validate_release_proxy_url(value):
    try:
        parsed = urlparse(value)
        hostname = (parsed.hostname or "").lower()
        allowed = any(hostname == domain or hostname.endswith("." + domain)
                      for domain in ("github.com", "githubusercontent.com"))
        if parsed.scheme != "https" or not allowed or parsed.username or parsed.password:
            raise HTTPException(status_code=403, detail="Domain not allowed")
        return value
    except HTTPException:
        raise
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid URL")


@app.get("/release-proxy")
def release_proxy(url: str = "", request: Request = None):
    """代理 GitHub release 下载文件（zipball/tarball/assets），服务端流量转发，支持断点续传"""
    if not url or not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid URL")
    _validate_release_proxy_url(url)
    resp = None

    try:
        # 构造请求头：透传客户端的 Range（断点续传）
        upstream_headers = get_github_headers()
        if request is not None and request.headers.get("range"):
            upstream_headers["Range"] = request.headers["range"]

        current_url = url
        for _ in range(6):
            resp = requests.get(current_url, headers=upstream_headers, timeout=120,
                                stream=True, allow_redirects=False)
            if resp.status_code not in (301, 302, 303, 307, 308):
                break
            redirect_url = resp.headers.get("location")
            resp.close()
            resp = None
            if not redirect_url:
                raise HTTPException(status_code=502, detail="Redirect without location")
            current_url = _validate_release_proxy_url(urljoin(current_url, redirect_url))
        else:
            raise HTTPException(status_code=502, detail="Too many upstream redirects")

        if not resp.ok:
            detail = f"Proxy fetch failed: HTTP {resp.status_code}"
            status_code = resp.status_code
            resp.close()
            resp = None
            raise HTTPException(status_code=status_code, detail=detail)

        # 透传关键响应头
        passthrough_headers = {
            "content-disposition", "content-type", "content-length",
            "content-range", "accept-ranges", "etag", "last-modified",
        }
        resp_headers = {}
        for h in passthrough_headers:
            if h in resp.headers:
                resp_headers[h] = resp.headers[h]

        # 上游未提供长度时保持分块传输，避免额外 HEAD 请求和重定向风险。
        content_length = resp.headers.get("content-length")

        # 添加缓存控制（大文件可缓存 10 分钟，小文件 1 小时）
        try:
            size = int(content_length) if content_length else 0
            max_age = 600 if size > 50 * 1024 * 1024 else 3600
        except (ValueError, TypeError):
            max_age = 600
        resp_headers["Cache-Control"] = f"public, max-age={max_age}"
        resp_headers["X-Proxy"] = "gitaap"
        # 标记为流式响应，防止 cache_control_middleware 错误缓存
        resp_headers["x-accel-buffering"] = "no"

        return StreamingResponse(
            resp.iter_content(chunk_size=65536),
            media_type=resp.headers.get("content-type", "application/octet-stream"),
                headers=resp_headers,
                status_code=resp.status_code,
                background=BackgroundTask(resp.close),
            )
    except HTTPException:
        if resp is not None:
            resp.close()
        raise
    except RequestException as e:
        if resp is not None:
            resp.close()
        print(f"[release-proxy] {e}"); raise HTTPException(status_code=502, detail="Proxy request failed")
    except Exception as e:
        if resp is not None:
            resp.close()
        print(f"[release-proxy] {e}"); raise HTTPException(status_code=500, detail="Proxy internal error")


# ────────── 手动触发 ──────────

@app.get("/rate-limit")
def get_rate_limit():
    """获取当前所有 GitHub Token 的速率限制状态（使用缓存，不强制刷新）"""
    try:
        all_tokens = _token_manager.get_all_token_info()
        total_limit = sum(t["limit"] for t in all_tokens)
        total_remaining = sum(t["remaining"] for t in all_tokens)
        total_used = sum(t["limit"] - t["remaining"] for t in all_tokens)
        return {
            "limit": total_limit,
            "remaining": total_remaining,
            "used": total_used,
            "has_token": bool(_get_github_token()),
            "token_count": len(_get_all_tokens()),
            "tokens": all_tokens,
        }
    except Exception as e:
        print(f"[rate-limit] 错误: {e}")
        return {"limit": 0, "remaining": 0, "used": 0, "has_token": False, "token_count": 0, "tokens": []}


@app.get("/token-stats")
def get_token_stats_api(granularity: str = "hour"):
    """获取请求统计，支持三级粒度：minute / hour / day"""
    try:
        if granularity not in ("minute", "hour", "day"):
            granularity = "hour"
        return get_token_stats(granularity)
    except Exception as e:
        print(f"[token-stats] 错误: {e}")
        return {"error": "Failed to load token statistics", "total_requests": 0,
                "total_unique_ips": 0, "granularity": granularity, "hours": []}


@app.get("/token-stats-page", response_class=HTMLResponse)
def token_stats_page():
    """渲染 Token 统计页面"""
    return templates.get_template("token-stats.html").render(
        static_version=_APP_STATIC_VERSION
    )


# ────────── 外部配额代理 ──────────

_QUOTA_CACHE = {"data": None, "ts": 0}

@app.get("/api/quota-status")
def proxy_quota_status():
    """代理转发外部共享 API 额度数据（绕过前端 CORS 限制）"""
    import time, urllib.request, json
    now = time.time()
    # 5 秒缓存
    if _QUOTA_CACHE["data"] and now - _QUOTA_CACHE["ts"] < 5:
        return _QUOTA_CACHE["data"]
    try:
        req = urllib.request.Request(
            "https://api.rtkl2025.com/quota-status/status",
            headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
            _QUOTA_CACHE["data"] = data
            _QUOTA_CACHE["ts"] = now
            return data
    except Exception as e:
        print(f"[quota-status] 代理请求失败: {e}")
        return {"error": str(e), "blocked": False, "remaining": 0, "limit": 80000000,
                "used": 0, "window_seconds": 10800, "next_release_at": 0,
                "full_clear_at": 0, "recovery_at": 0, "usage_records": 0,
                "server_time": int(now)}


# ────────── 插件管理 ──────────

@app.get("/plugins", response_class=HTMLResponse)
def plugins_page():
    """渲染插件管理页面"""
    return templates.get_template("plugins.html").render(
        static_version=_APP_STATIC_VERSION
    )


PLUGIN_BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "plugins", "available")

def _calc_plugin_size(plugin_id: str) -> str:
    """计算插件目录下所有文件的总大小，返回可读字符串"""
    plugin_dir = os.path.join(PLUGIN_BASE_DIR, plugin_id)
    if not os.path.isdir(plugin_dir):
        return "0B"
    total = 0
    for dirpath, _, filenames in os.walk(plugin_dir):
        for fn in filenames:
            fp = os.path.join(dirpath, fn)
            try: total += os.path.getsize(fp)
            except OSError: pass
    if total < 1024:
        return f"{total}B"
    elif total < 1024 * 1024:
        return f"{total / 1024:.1f}KB"
    else:
        return f"{total / (1024 * 1024):.1f}MB"

PLUGIN_REGISTRY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "plugins", "registry.json")
_PLUGIN_REGISTRY_LOCK = threading.Lock()


def _sync_plugin_sizes() -> None:
    """把 registry 中各插件的 size 字段刷新为磁盘实际大小。

    size 不应硬编码：插件代码变动后旧值会失真，这里在启动时统一按目录实际体积重算。
    """
    try:
        with _PLUGIN_REGISTRY_LOCK:
            with open(PLUGIN_REGISTRY_PATH, "r", encoding="utf-8") as f:
                registry = json.load(f)
            # registry.json 可能被外部改坏，遍历前校验数据形态，避免抛出未预期异常
            if not isinstance(registry, dict):
                print("[plugins] registry.json 顶层不是对象，跳过 size 同步")
                return
            plugins = registry.get("plugins")
            if not isinstance(plugins, list):
                print("[plugins] registry.json 的 plugins 不是数组，跳过 size 同步")
                return
            changed = False
            for plugin in plugins:
                if not isinstance(plugin, dict):
                    continue
                plugin_id = plugin.get("id")
                if not plugin_id or not isinstance(plugin_id, str):
                    continue
                actual = _calc_plugin_size(plugin_id)
                if plugin.get("size") != actual:
                    plugin["size"] = actual
                    changed = True
            if not changed:
                return
            registry["updated_at"] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            tmp_path = f"{PLUGIN_REGISTRY_PATH}.{os.getpid()}.{threading.get_ident()}.tmp"
            try:
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(registry, f, ensure_ascii=False, indent=2)
                os.replace(tmp_path, PLUGIN_REGISTRY_PATH)
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
    except (OSError, ValueError, AttributeError, TypeError) as e:
        # registry.json 损坏不应中断服务启动，降级为打印日志
        # OSError 覆盖 IOError/PermissionError；ValueError 覆盖 JSONDecodeError/UnicodeDecodeError
        print(f"[plugins] size 同步失败: {e}")


def _set_plugin_enabled(plugin_id, enabled):
    with _PLUGIN_REGISTRY_LOCK:
        with open(PLUGIN_REGISTRY_PATH, "r", encoding="utf-8") as f:
            registry = json.load(f)
        for plugin in registry.get("plugins", []):
            if plugin.get("id") == plugin_id:
                plugin["enabled"] = enabled
                plugin["size"] = _calc_plugin_size(plugin_id)
                registry["updated_at"] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
                tmp_path = f"{PLUGIN_REGISTRY_PATH}.{os.getpid()}.{threading.get_ident()}.tmp"
                try:
                    with open(tmp_path, "w", encoding="utf-8") as f:
                        json.dump(registry, f, ensure_ascii=False, indent=2)
                    os.replace(tmp_path, PLUGIN_REGISTRY_PATH)
                finally:
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)
                return {"status": "ok", "id": plugin_id, "enabled": enabled}
    raise HTTPException(status_code=404, detail=f"Plugin '{plugin_id}' not found")

@app.post("/plugins/toggle")
async def toggle_plugin(request: Request):
    """启用/禁用插件（需管理员登录）"""
    # CSRF 保护 + 管理员鉴权
    _check_csrf(request)
    _check_admin(request)
    try:
        body = await request.json()
        plugin_id = body.get("id", "").strip()
        enabled = body.get("enabled", True)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    if not plugin_id:
        raise HTTPException(status_code=400, detail="Plugin ID is required")
    if not isinstance(enabled, bool):
        raise HTTPException(status_code=400, detail="enabled must be a boolean")

    try:
        return _set_plugin_enabled(plugin_id, enabled)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[plugins/toggle] 错误: {e}")
        raise HTTPException(status_code=500, detail="Failed to toggle plugin")

@app.get("/docs", response_class=HTMLResponse)
def docs_page(file: str = "DEVELOPER.md"):
    """文档页面：前端请求带身份令牌，后端返回 MD 原文，前端 marked.js 渲染"""
    # 安全检查：防止路径穿越
    safe_name = os.path.basename(file)
    if not safe_name.endswith(".md"):
        safe_name += ".md"
    doc_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "docs", safe_name)
    if not os.path.exists(doc_path):
        return HTMLResponse(
            content="<h1>Document not found</h1><p>File not found.</p>",
            status_code=404,
        )
    # 生成一次性身份令牌
    token = _generate_docs_token(safe_name)
    return templates.get_template("docs.html").render(
        static_version=_APP_STATIC_VERSION,
        docs_file=safe_name,
        docs_token=token,
    )


@app.get("/docs/md")
def docs_md(file: str = "", request: Request = None):
    """返回 MD 原文，需验证身份令牌"""
    token = request.headers.get("X-Docs-Token", "")
    if not token or not file:
        raise HTTPException(status_code=403, detail="Missing token or file parameter")
    safe_name = os.path.basename(file)
    if not safe_name.endswith(".md"):
        safe_name += ".md"
    if not _verify_docs_token(token, safe_name):
        raise HTTPException(status_code=403, detail="Invalid or expired token")
    doc_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "docs", safe_name)
    if not os.path.exists(doc_path):
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        with open(doc_path, "r", encoding="utf-8") as f:
            return Response(content=f.read(), media_type="text/markdown")
    except (IOError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to read document: {e}")


@app.get("/developers")
def developers_redirect():
    """旧链接重定向到新版文档页"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs", status_code=301)


# ── TAC 验证码代理 ──
# 通过 FastAPI 代理前端请求到 TAC Docker 服务，解决跨域问题
# httpx 在函数内懒加载，避免模块导入时因 httpx 未安装而阻断后续路由

# TAC 容器地址（Docker Compose 网络内用容器名，宿主机用 localhost:9222）
TAC_SERVER = os.getenv("TAC_SERVER", "http://127.0.0.1:9222")

def _get_httpx():
    """懒加载 httpx，避免模块导入时因依赖缺失阻断整个路由表"""
    import httpx as _httpx
    return _httpx

@app.get("/tac/get")
async def tac_get(type: str = "WORD_IMAGE_CLICK"):
    """代理 TAC 生成验证码请求"""
    _httpx = _get_httpx()
    try:
        async with _httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{TAC_SERVER}/tac/get", params={"type": type})
            return Response(content=resp.content, media_type=resp.headers.get("content-type", "application/json"),
                            status_code=resp.status_code)
    except _httpx.ConnectError:
        raise HTTPException(status_code=503, detail="TAC service unavailable or connection refused")
    except _httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="TAC service response timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TAC proxy error: {type(e).__name__}")

@app.post("/tac/check")
async def tac_check(request: Request):
    """代理 TAC 校验验证码请求（含前端校验和二次校验）"""
    _httpx = _get_httpx()
    try:
        body = await request.body()
        async with _httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{TAC_SERVER}/tac/check",
                content=body,
                headers={"Content-Type": "application/json"},
            )
            return Response(content=resp.content, media_type=resp.headers.get("content-type", "application/json"),
                            status_code=resp.status_code)
    except _httpx.ConnectError:
        raise HTTPException(status_code=503, detail="TAC service unavailable or connection refused")
    except _httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="TAC service response timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TAC proxy error: {type(e).__name__}")


# ── 管理员登录与会话 ──

# 警告：默认密码仅用于本地开发，生产环境必须通过 ADMIN_PASSWORD 环境变量设置
_DEFAULT_ADMIN_PW = secrets.token_hex(8)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", _DEFAULT_ADMIN_PW)
if ADMIN_PASSWORD == _DEFAULT_ADMIN_PW:
    if os.getenv("DEBUG", "").lower() in ("true", "1", "yes"):
        print(f"[admin] WARNING: Using auto-generated admin password: {ADMIN_PASSWORD}")
    else:
        print("[admin] WARNING: ADMIN_PASSWORD env var not set. A random password has been generated.")
        print("[admin] Set ADMIN_PASSWORD in docker-compose.yml or check server logs with DEBUG=true for the password.")

# 会话存储：{token: {"expiry": sliding_expiry_ts, "created": creation_ts}}
ADMIN_SESSION = {}
_ADMIN_SESSION_LOCK = threading.Lock()
_ADMIN_SESSION_MAX_AGE = 86400  # 会话绝对最长存活时间：24 小时

# Cookie Secure 属性：仅 HTTPS 部署可启用。
# 默认 compose 以 http://host:4000 暴露服务，若强制 secure=True，
# 浏览器会静默丢弃 admin_token，表现为「登录成功但立刻又要求登录」。
_COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").strip().lower() in ("1", "true", "yes", "on")

# 登录失败记录：{ip: [timestamp, ...]}
_LOGIN_FAIL = {}
_LOGIN_FAIL_LOCK = threading.Lock()
_LOGIN_BAN = {}  # {ip: unban_timestamp}
_LOGIN_BAN_LOCK = threading.Lock()

def _cleanup_admin_sessions():
    """清理过期会话和封禁记录（防内存泄漏）"""
    now = time.time()
    with _ADMIN_SESSION_LOCK:
        expired = [t for t, s in ADMIN_SESSION.items() if s["expiry"] <= now or now - s["created"] > _ADMIN_SESSION_MAX_AGE]
        for t in expired:
            del ADMIN_SESSION[t]
    with _LOGIN_FAIL_LOCK:
        expired_fails = [ip for ip, ts in _LOGIN_FAIL.items() if now - max(ts) > 300]
        for ip in expired_fails:
            del _LOGIN_FAIL[ip]
    with _LOGIN_BAN_LOCK:
        expired_bans = [ip for ip, ts in _LOGIN_BAN.items() if ts <= now]
        for ip in expired_bans:
            del _LOGIN_BAN[ip]
    with _last_fetch_lock:
        stale_fetch = [ip for ip, ts in _last_fetch.items() if now - ts > 300]
        for ip in stale_fetch:
            del _last_fetch[ip]

# 每小时执行一次清理（daemon 线程，不会阻塞进程退出）
_cleanup_event = threading.Event()

def _cleanup_loop():
    while not _cleanup_event.wait(timeout=3600):
        _cleanup_admin_sessions()

_admin_cleanup_thread = threading.Thread(target=_cleanup_loop, daemon=True)
_admin_cleanup_thread.start()

def _check_login_banned(ip: str) -> bool:
    """检查 IP 是否因登录失败被封禁"""
    with _LOGIN_BAN_LOCK:
        unban = _LOGIN_BAN.get(ip)
        if unban:
            if time.time() > unban:
                del _LOGIN_BAN[ip]
                return False
            return True
    return False

def _record_login_fail(ip: str):
    """记录登录失败，连续 5 次封禁 15 分钟"""
    now = time.time()
    with _LOGIN_FAIL_LOCK:
        if ip not in _LOGIN_FAIL:
            _LOGIN_FAIL[ip] = []
        _LOGIN_FAIL[ip].append(now)
        # 只保留最近 10 分钟的记录
        _LOGIN_FAIL[ip] = [t for t in _LOGIN_FAIL[ip] if now - t < 600]
        if len(_LOGIN_FAIL[ip]) >= 5:
            with _LOGIN_BAN_LOCK:
                _LOGIN_BAN[ip] = now + 900  # 15 分钟

def _make_admin_token() -> str:
    """生成管理员会话令牌（有效期 2 小时，绝对最长 24 小时）"""
    token = secrets.token_hex(24)
    now = time.time()
    with _ADMIN_SESSION_LOCK:
        ADMIN_SESSION[token] = {"expiry": now + 7200, "created": now}
    return token

def _check_admin(request: Request):
    """验证管理员会话，失败返回 403"""
    token = request.cookies.get("admin_token", "")
    with _ADMIN_SESSION_LOCK:
        session = ADMIN_SESSION.get(token)
        if not session:
            raise HTTPException(status_code=403, detail="Please login first")
        now = time.time()
        if now > session["expiry"] or now - session["created"] > _ADMIN_SESSION_MAX_AGE:
            del ADMIN_SESSION[token]
            raise HTTPException(status_code=403, detail="Session expired, please login again")
        new_expiry = min(now + 7200, session["created"] + _ADMIN_SESSION_MAX_AGE)
        ADMIN_SESSION[token] = {"expiry": new_expiry, "created": session["created"]}
    return True

@app.get("/admin", response_class=HTMLResponse)
def admin_login_page():
    """管理员登录页"""
    return templates.get_template("admin-login.html").render(
        static_version=_APP_STATIC_VERSION,
        admin_password_set=os.getenv("ADMIN_PASSWORD") is not None,
    )

@app.post("/admin/login")
async def admin_login(request: Request):
    """管理员登录验证"""
    # CSRF 保护
    _check_csrf(request)
    ip = request.client.host if request.client else "unknown"

    # IP 封禁检查
    if _check_login_banned(ip):
        raise HTTPException(status_code=429, detail="Too many login attempts, please try again in 15 minutes")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request format")

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid request format")

    password = (body.get("password") or "").strip()
    if not password:
        raise HTTPException(status_code=400, detail="Invalid request format")

    if not hmac.compare_digest(password.encode("utf-8"), ADMIN_PASSWORD.encode("utf-8")):
        _record_login_fail(ip)
        # 返回通用错误信息，不透露是密码错误还是用户不存在
        raise HTTPException(status_code=403, detail="登录失败")

    with _LOGIN_FAIL_LOCK:
        _LOGIN_FAIL.pop(ip, None)
    token = _make_admin_token()
    resp = Response(content=json.dumps({"status": "ok"}), media_type="application/json")
    resp.set_cookie(
        key="admin_token", value=token,
        max_age=7200, httponly=True,
        # secure 只能在 HTTPS 下启用：默认部署是 http://host:4000，
        # 硬编码 secure=True 会让浏览器直接丢弃该 Cookie，导致登录后仍被判未登录。
        # 由 COOKIE_SECURE 环境变量控制（HTTPS 部署时置 true）。
        secure=_COOKIE_SECURE,
        samesite="strict", path="/",
    )
    return resp

@app.get("/admin/manage", response_class=HTMLResponse)
def admin_manage(request: Request):
    """管理员管理面板"""
    _check_admin(request)
    return templates.get_template("admin-manage.html").render(
        static_version=_APP_STATIC_VERSION,
    )

@app.post("/admin/logout")
def admin_logout(request: Request):
    """管理员登出"""
    # CSRF 保护
    _check_csrf(request)
    token = request.cookies.get("admin_token", "")
    with _ADMIN_SESSION_LOCK:
        ADMIN_SESSION.pop(token, None)
    resp = Response(content=json.dumps({"status": "ok"}), media_type="application/json")
    resp.delete_cookie("admin_token", path="/")
    return resp

@app.get("/admin/plugins")
def admin_plugins(request: Request):
    """管理员获取插件列表"""
    _check_admin(request)
    registry_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "plugins", "registry.json")
    if not os.path.exists(registry_path):
        raise HTTPException(status_code=404, detail="Plugin registry not found")
    try:
        with open(registry_path, "r", encoding="utf-8") as f:
            return Response(content=f.read(), media_type="application/json")
    except (IOError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to read plugin registry: {e}")


# ────────── 管理员运维操作 ──────────

def _mask_ip(ip: str) -> str:
    """脱敏 IP：仅保留网段，避免管理面板与日志泄露完整访客地址。"""
    if not ip or not isinstance(ip, str):
        return "unknown"
    if ":" in ip:  # IPv6：保留前两段
        parts = [p for p in ip.split(":") if p]
        return ":".join(parts[:2]) + ":***" if parts else "unknown"
    parts = ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.*.*"
    return "unknown"


def _read_plugin_registry() -> dict:
    """在锁内读取 registry.json，返回 dict；结构异常时返回空结构而非抛出。"""
    with _PLUGIN_REGISTRY_LOCK:
        with open(PLUGIN_REGISTRY_PATH, "r", encoding="utf-8") as f:
            registry = json.load(f)
    if not isinstance(registry, dict):
        return {"plugins": []}
    if not isinstance(registry.get("plugins"), list):
        registry["plugins"] = []
    return registry


@app.get("/admin/status")
def admin_status(request: Request):
    """运行时概览：会话、登录封禁、缓存与插件状态，供管理面板展示。"""
    _check_admin(request)
    now = time.time()
    with _ADMIN_SESSION_LOCK:
        sessions = [
            {
                "created_ago": int(now - s["created"]),
                "expires_in": max(0, int(s["expiry"] - now)),
            }
            for s in ADMIN_SESSION.values()
        ]
    with _LOGIN_BAN_LOCK:
        banned = [
            {"ip": _mask_ip(ip), "unban_in": max(0, int(ts - now))}
            for ip, ts in _LOGIN_BAN.items() if ts > now
        ]
    with _LOGIN_FAIL_LOCK:
        failing = sum(1 for v in _LOGIN_FAIL.values() if v)
    try:
        plugin_total = len(_read_plugin_registry().get("plugins", []))
        plugin_enabled = sum(1 for p in _read_plugin_registry().get("plugins", []) if p.get("enabled"))
    except Exception:
        plugin_total = plugin_enabled = -1
    return {
        "status": "ok",
        "session_count": len(sessions),
        "sessions": sessions,
        "banned_ips": banned,
        "failing_ips": failing,
        "cache": cache_stats(),
        "cookie_secure": _COOKIE_SECURE,
        "password_from_env": os.getenv("ADMIN_PASSWORD") is not None,
        "plugins": {"total": plugin_total, "enabled": plugin_enabled},
    }


@app.post("/admin/cache/clear")
def admin_clear_cache(request: Request):
    """清空 GitHub 响应缓存。"""
    _check_csrf(request)
    _check_admin(request)
    before = cache_stats()
    clear_cache()
    return {"status": "ok", "cleared": before.get("total", 0), "cache": cache_stats()}


@app.post("/admin/sessions/revoke-others")
def admin_revoke_other_sessions(request: Request):
    """吊销除当前会话外的所有管理员会话（密码疑似泄露时的应急操作）。"""
    _check_csrf(request)
    _check_admin(request)
    current = request.cookies.get("admin_token", "")
    with _ADMIN_SESSION_LOCK:
        others = [t for t in ADMIN_SESSION if t != current]
        for t in others:
            del ADMIN_SESSION[t]
    return {"status": "ok", "revoked": len(others)}


@app.post("/admin/logins/unban")
def admin_unban_logins(request: Request):
    """解除登录失败导致的 IP 封禁。"""
    _check_csrf(request)
    _check_admin(request)
    with _LOGIN_BAN_LOCK:
        count = len(_LOGIN_BAN)
        _LOGIN_BAN.clear()
    with _LOGIN_FAIL_LOCK:
        _LOGIN_FAIL.clear()
    return {"status": "ok", "unbanned": count}

@app.post("/admin/plugins/toggle")
async def admin_plugins_toggle(request: Request):
    """管理员启用/禁用插件"""
    # CSRF 保护 + 管理员鉴权
    _check_csrf(request)
    _check_admin(request)
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    plugin_id = body.get("id", "").strip()
    enabled = body.get("enabled", True)
    if not plugin_id:
        raise HTTPException(status_code=400, detail="Plugin ID is required")
    if not isinstance(enabled, bool):
        raise HTTPException(status_code=400, detail="enabled must be a boolean")
    try:
        return _set_plugin_enabled(plugin_id, enabled)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[admin/plugins/toggle] 错误: {e}")
        raise HTTPException(status_code=500, detail="Operation failed")




@app.post("/fetch-now")
def fetch_now(request: Request):
    """手动触发流量数据抓取（带 CSRF 保护 + 速率限制）"""
    # CSRF 保护：必须存在有效的 Origin 或 Referer 头
    _check_csrf(request)
    _check_admin(request)
    # 速率限制：单个 IP 每 30 秒只能触发一次
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    with _last_fetch_lock:
        stale_ips = [key for key, timestamp in _last_fetch.items() if now - timestamp > 300]
        for stale_ip in stale_ips:
            del _last_fetch[stale_ip]
        last_fetch = _last_fetch.get(ip, 0)
        if now - last_fetch < 30:
            raise HTTPException(status_code=429, detail="Too many requests. Please wait 30 seconds.")
        _last_fetch[ip] = now
    try:
        fetch_and_store()
        return {"status": "fetched"}
    except Exception as e:
        print(f"[fetch-now] {e}"); return {"error": "抓取失败", "status": "failed"}


# ────────── 手动重载配置 ──────────

@app.post("/reload-config")
def reload_config(request: Request):
    """手动触发 .env 配置重载（带 CSRF 保护）"""
    # CSRF 保护
    _check_csrf(request)
    _check_admin(request)
    # 强制重载
    try:
        if not _hot_reload_config(force=True):
            return {"status": "error", "message": ".env file not found"}
        return {
            "status": "reloaded",
            "token_count": len(_token_manager.get_all_tokens()),
            "tokens": [
                {"name": n, "masked": _token_manager.mask_token(t)}
                for t, n in _token_manager.get_token_names().items()
            ],
            "repos": REPOS,
        }
    except Exception as e:
        print(f"[reload-config] {e}"); return {"status": "error", "message": "配置重载失败"}


# ────────── 话题标签描述 ──────────

@app.get("/topic-desc")
def get_topic_desc(topic: str = ""):
    """获取 GitHub 话题标签的描述信息"""
    if not topic:
        return {"topic": "", "description": None}
    try:
        # 使用 GitHub 搜索 API 获取话题描述
        url = f"https://api.github.com/search/topics?q={quote(topic)}"
        data = cached_get(url, ttl=86400)  # 缓存 24 小时，话题描述很少变化
        if data and isinstance(data, dict):
            items = data.get("items", [])
            for item in items:
                if item.get("name", "").lower() == topic.lower():
                    return {"topic": topic, "description": item.get("description")}
        return {"topic": topic, "description": None}
    except Exception as e:
        return {"topic": topic, "description": None, "error": str(e)[:100]}


# ────────── 许可证信息 ──────────

# 常见开源许可证的中文说明（仅供参考）
_LICENSE_ZH = {
    "mit": "MIT 许可证是一种宽松的许可协议，允许他人自由使用、复制、修改、合并、出版、分发、再许可和/或销售软件副本，"
           "仅要求保留版权声明和许可声明。",
    "apache-2.0": "Apache 2.0 许可证是一种宽松的许可协议，允许他人自由使用、修改和分发软件，"
                  "但需要保留原始版权声明，并明确标注修改内容。同时包含专利授权条款。",
    "gpl-2.0": "GNU GPL v2.0 是一种强 Copyleft 许可证，要求任何分发或修改后的作品必须同样以 GPL v2.0 许可证发布，"
               "并公开源代码。",
    "gpl-3.0": "GNU GPL v3.0 是 GPL v2.0 的升级版，增加了对专利 retaliation 和反 DRM 条款，"
               "同样要求衍生作品必须保持相同许可证。",
    "lgpl-2.1": "GNU LGPL v2.1 允许在商业软件中以库的形式链接本软件，而不强制要求商业软件开源。",
    "lgpl-3.0": "GNU LGPL v3.0 是 LGPL v2.1 的升级版，兼容 GPL v3.0。",
    "bsd-2-clause": "BSD 2-Clause 许可证是一种宽松协议，允许自由使用、修改和分发，仅要求保留版权声明。",
    "bsd-3-clause": "BSD 3-Clause 许可证在 BSD 2-Clause 基础上增加了禁止使用作者姓名进行推广的条款。",
    "unlicense": "Unlicense 是一种公共领域等效许可证，放弃所有版权，将作品贡献到公共领域。",
    "cc0-1.0": "CC0 1.0 是一种公共领域贡献协议，作者在法律允许的范围内放弃所有版权。",
    "epl-2.0": "Eclipse Public License v2.0 是一种 Copyleft 许可证，适用于 Eclipse 基金会项目，"
               "要求修改后的文件保持相同许可证。",
    "mpl-2.0": "Mozilla Public License v2.0 是一种弱 Copyleft 许可证，修改后的文件需要保持 MPL 许可证，"
               "但可以与其他许可证代码组合。",
}

@app.get("/license-info")
def get_license_info(spdx_id: str = ""):
    """获取开源许可证的详细信息（名称、描述、法律文本、中文说明）"""
    if not spdx_id:
        return {"error": "spdx_id is required"}
    spdx_id = spdx_id.upper()
    try:
        url = f"https://api.github.com/licenses/{spdx_id.lower()}"
        data = cached_get(url, ttl=86400)  # 缓存 24 小时
        if data is None:
            return {"spdx_id": spdx_id, "error": "License not found"}
        return {
            "spdx_id": spdx_id,
            "name": data.get("name"),
            "description": data.get("description"),
            "body": data.get("body"),
            "implementation": data.get("implementation"),
            "permissions": data.get("permissions", []),
            "conditions": data.get("conditions", []),
            "limitations": data.get("limitations", []),
            "zh_description": _LICENSE_ZH.get(spdx_id.lower()),
            "disclaimer": "以下内容仅供参考，不构成法律建议。如需法律意见，请咨询专业律师。",
        }
    except Exception as e:
        return {"spdx_id": spdx_id, "error": str(e)[:100]}


# ────────── 编程语言信息 ──────────

# 常见编程语言的中文简介
@app.get("/language-info")
def get_language_info(lang: str = ""):
    """获取编程语言的详细信息"""
    if not lang:
        return {"error": "lang parameter is required"}
    key = lang.lower().strip()
    # 从翻译文件加载语言信息
    try:
        json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "lang", "zh.json")
        with open(json_path, 'r', encoding='utf-8') as f:
            _translations = json.load(f)
        _LANGUAGE_INFO = _translations.get("languages", {})
    except (FileNotFoundError, json.JSONDecodeError):
        _LANGUAGE_INFO = {}
    info = _LANGUAGE_INFO.get(key)
    if info:
        return {"name": lang, **info}
    # 未知语言，尝试从 GitHub API 搜索
    try:
        url = f"https://api.github.com/search/repositories?q=language:{quote(lang)}&per_page=1"
        data = cached_get(url, ttl=86400)
        if data and data.get("total_count", 0) > 0:
            return {"name": lang, "summary": f"{lang} 是一种编程语言，在 GitHub 上有 {data['total_count']:,} 个仓库使用。"}
        return {"name": lang, "summary": f"{lang} 是一种编程语言。"}
    except Exception as e:
        return {"name": lang, "summary": f"{lang} 是一种编程语言。", "error": str(e)[:100]}


# ────────── 手动添加 Token ──────────

# 用户手动添加的 Token（不持久化到 .env，仅内存中保持）
# 定义已提前到文件顶部 env watcher 之前，此处保留注释说明

@app.post("/add-token")
async def add_token(request: Request):
    """手动添加一个 GitHub Token（仅内存中，重启后失效）"""
    # CSRF 保护
    _check_csrf(request)
    _check_admin(request)

    try:
        body = await request.json()
        token = (body.get("token") or "").strip()
        name = (body.get("name") or "").strip() or None
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    # 验证 token 格式（基本校验）
    if not re.fullmatch(r"(?:ghp_|gho_|ghu_|ghs_|ghf_|github_pat_)[A-Za-z0-9_]{10,}", token):
        raise HTTPException(status_code=400, detail="Invalid token format")

    # 先向 GitHub 验证，避免无效 Token 污染全局选择状态。
    try:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "GitAAP/1.0 (github-repo-monitor)",
            "Authorization": f"Bearer {token}",
        }
        resp = requests.get("https://api.github.com/rate_limit", headers=headers, timeout=10)
        try:
            if not resp.ok:
                raise HTTPException(status_code=400, detail="GitHub rejected this token")
            data = resp.json()
            core = data.get("resources", {}).get("core", {})
            expires_at = resp.headers.get("X-GitHub-Token-Expires-At")
        finally:
            resp.close()
    except HTTPException:
        raise
    except (RequestException, ValueError, TypeError) as e:
        print(f"[add-token] Token 验证失败: {_sanitize_log(e)}")
        raise HTTPException(status_code=502, detail="Unable to validate token with GitHub")

    with _config_lock:
        display_name = name or f"手动添加 #{len(_manual_tokens) + 1}"
        if not _token_manager.add_token(token, display_name):
            raise HTTPException(status_code=409, detail="Token already exists")
        _manual_tokens[token] = display_name
        # 持久化到 .env：读取当前 GITHUB_TOKENS 追加或新增
        existing = os.environ.get("GITHUB_TOKENS", "").strip()
        new_entry = f"{display_name}={token}"
        if existing:
            # 避免重复
            if new_entry not in existing.split(","):
                updated = existing + "," + new_entry
                _write_dotenv_key("GITHUB_TOKENS", updated)
        else:
            _write_dotenv_key("GITHUB_TOKENS", new_entry)
    _token_manager.update_rate_limit(
        token,
        core.get("remaining", 0),
        core.get("limit", 0),
        core.get("reset", 0),
        expires_at=expires_at,
    )
    clear_cache()

    return {
        "status": "ok",
        "masked": _token_manager.mask_token(token),
        "name": display_name,
        "token_count": len(_token_manager.get_all_tokens()),
    }


# ────────── 深度学习流量预测 ──────────

@app.get("/predict")
def get_prediction(repo: str = "", metric: str = "clones", steps: int = 14):
    """
    基于神经网络（纯 Python 自实现）的流量预测 API。
    返回历史数据 + 未来 predictions 天的预测值。
    """
    if not repo:
        raise HTTPException(status_code=400, detail="repo parameter is required")
    _require_configured_repo(repo)
    if metric not in ("clones", "views"):
        raise HTTPException(status_code=400, detail="metric must be 'clones' or 'views'")
    steps = max(1, min(steps, 90))

    try:
        from backend.services.predictor import predict_traffic, get_prediction_loss
        result = predict_traffic(repo, metric=metric, steps=steps)
        if "error" in result:
            return result
        # 附加 loss 曲线
        result["loss_history"] = get_prediction_loss(repo, metric=metric)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "repo": repo, "metric": metric}


@app.post("/predict/train")
async def retrain_prediction(request: Request):
    """强制重新训练指定仓库的预测模型"""
    _check_csrf(request)
    _check_admin(request)
    try:
        body = await request.json()
        if not isinstance(body, dict):
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    repo = body.get("repo", "")
    metric = body.get("metric", "clones")
    if not repo:
        raise HTTPException(status_code=400, detail="repo is required")
    _require_configured_repo(repo)
    if metric not in ("clones", "views"):
        raise HTTPException(status_code=400, detail="metric must be 'clones' or 'views'")
    try:
        from backend.services.predictor import predict_traffic, get_prediction_loss
        result = await run_in_threadpool(predict_traffic, repo, metric, 14, True)
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])
        return {
            "status": "ok",
            "repo": repo,
            "metric": metric,
            "loss_history": get_prediction_loss(repo, metric=metric),
            "message": f"Model retrained for {repo} ({metric})",
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"error": str(e)}


# ────────── 翻译代理 ──────────

@app.get("/translate")
def translate_text(text: str = "", to: str = "zh-Hans", from_lang: str = "auto"):
    """翻译文本，优先使用 Microsoft Translator API，可配置密钥"""
    if not text:
        return {"error": "text is required"}
    # 截断过长文本（1000 字符以内）
    text = text[:1000]
    # 校验目标语言参数
    supported_langs = {"zh-Hans", "zh-Hant", "en", "ja", "ko", "fr", "de", "es", "ru", "pt", "it", "ar", "nl", "sv", "da", "fi", "pl", "th", "vi"}
    if to not in supported_langs:
        return {"error": f"Unsupported target language: {to}"}
    key = os.getenv("MICROSOFT_TRANSLATOR_KEY", "")
    if key:
        # 使用 Azure 付费密钥
        url = f"https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from={from_lang}&to={to}"
        try:
            resp = requests.post(url, headers={
                "Ocp-Apim-Subscription-Key": key,
                "Content-Type": "application/json",
                "User-Agent": "GitAAP/1.0"
            }, json=[{"Text": text}], timeout=15)
            if resp.ok:
                result = resp.json()
                if isinstance(result, list) and len(result) > 0 and "translations" in result[0]:
                    translated = result[0]["translations"][0]["text"]
                    return {"translated": translated, "source": result[0].get("detectedLanguage", {}).get("language", from_lang)}
        except Exception as e:
            print(f"[translate] API error: {e}")
    # 无密钥时使用 Bing 公共翻译接口
    try:
        resp = requests.post(f"https://api-edge.cognitive.microsofttranslator.com/translate?from={from_lang}&to={to}&api-version=3.0", headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; GitAAP/1.0)"
        }, json=[{"Text": text}], timeout=15)
        if resp.ok:
            result = resp.json()
            if isinstance(result, list) and len(result) > 0 and "translations" in result[0]:
                translated = result[0]["translations"][0]["text"]
                return {"translated": translated, "source": result[0].get("detectedLanguage", {}).get("language", from_lang)}
    except Exception as e:
        print(f"[translate] public API error: {e}")
    return {"error": "Translation failed (no valid API key configured)"}


# ────────── Mindustry 模组商店 ──────────

MODS_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "mods_cache.json")
MODS_SOURCE_URL = "https://raw.githubusercontent.com/Anuken/MindustryMods/master/mods.json"
MODS_CACHE_TTL = 3600  # 1 小时
MODS_RETRY_MIN_INTERVAL = 300  # 远端不可用时最少等待 5 分钟再重试
_MODS_CACHE_LOCK = threading.Lock()
_last_cache_refresh_failed = 0.0  # 上次刷新失败的时间戳


def _write_cache_atomically(data):
    """原子写入缓存文件"""
    tmp_path = f"{MODS_CACHE_FILE}.{os.getpid()}.{threading.get_ident()}.tmp"
    try:
        os.makedirs(os.path.dirname(MODS_CACHE_FILE), exist_ok=True)
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, MODS_CACHE_FILE)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _load_mods_cache():
    """读取或原子刷新模组缓存，返回 (缓存对象, 缓存秒数)。"""
    now = time.time()
    with _MODS_CACHE_LOCK:
        cache_data = None
        cache_age = None
        if os.path.exists(MODS_CACHE_FILE):
            try:
                with open(MODS_CACHE_FILE, "r", encoding="utf-8") as f:
                    cache_data = json.load(f)
                if isinstance(cache_data, dict):
                    cache_age = max(0, now - cache_data.get("_cached_at", 0))
                elif isinstance(cache_data, list):
                    cache_age = MODS_CACHE_TTL + 1
                else:
                    cache_data = None
            except (json.JSONDecodeError, IOError, TypeError, ValueError):
                cache_data = None

        need_refresh = False
        if cache_data is None or cache_age is None:
            need_refresh = True
        elif cache_age > MODS_CACHE_TTL:
            need_refresh = True

        if need_refresh and time.time() - _last_cache_refresh_failed > MODS_RETRY_MIN_INTERVAL:
            resp = None
            try:
                resp = requests.get(MODS_SOURCE_URL, timeout=10,
                                    headers={"User-Agent": "GitAAP/1.0"})
                if resp.ok:
                    remote = resp.json()
                    if isinstance(remote, list):
                        remote = {"mods": remote}
                    if isinstance(remote, dict) and isinstance(remote.get("mods"), list):
                        remote["_cached_at"] = now
                        _write_cache_atomically(remote)
                        cache_data = remote
                        cache_age = 0
                    else:
                        print(f"[mods-cache] 远端数据格式异常: type={type(remote).__name__}")
                else:
                    print(f"[mods-cache] 远端 HTTP {resp.status_code}")
            except (RequestException, ValueError, TypeError) as e:
                print(f"[mods-cache] 刷新失败: {e}")
            finally:
                if resp is not None:
                    resp.close()

            # 远端不可用时，更新 _cached_at 避免每次请求都重试
            if cache_age is not None and cache_age > MODS_CACHE_TTL and isinstance(cache_data, dict):
                cache_data["_cached_at"] = now
                _write_cache_atomically(cache_data)
                cache_age = 0
                _last_cache_refresh_failed = now
                print(f"[mods-cache] 保留旧缓存，{MODS_RETRY_MIN_INTERVAL}s 后重试")
            elif cache_data is None:
                # 无缓存且远端不可用，也标记失败时间避免每次请求都阻塞重试
                _last_cache_refresh_failed = now
                print(f"[mods-cache] 无可用缓存，{MODS_RETRY_MIN_INTERVAL}s 后重试")
        return cache_data, cache_age

@app.get("/api/mods")
def get_mods():
    """返回模组列表（优先本地缓存，每1小时自动更新）"""
    cache_data, cache_age = _load_mods_cache()

    if cache_data is None:
        return {"error": "无法获取模组数据，请稍后重试", "mods": []}
    
    # 兼容两种数据格式：{"mods": [...]} 或 顶层 [...]
    mods_list = cache_data if isinstance(cache_data, list) else cache_data.get("mods", [])
    result = {"mods": mods_list, "_cached_age": int(cache_age) if cache_age else 0}
    if cache_age is not None and cache_age > MODS_CACHE_TTL * 1.5:
        result["_warning"] = "模组数据更新时间超过预期，部分信息可能不是最新的"
    return result


@app.get("/api/mods/page")
def get_mods_page(page: int = Query(1, ge=1), size: int = Query(24, ge=1, le=100), sort: str = "default",
                   search: str = "", author: str = "", lang: str = ""):
    """分页返回模组列表，支持排序、搜索、过滤"""
    cache_data, cache_age = _load_mods_cache()

    if cache_data is None:
        return {"error": "无法获取模组数据", "mods": [], "total": 0}

    mods = cache_data if isinstance(cache_data, list) else cache_data.get("mods", [])
    if not isinstance(mods, list):
        return {"error": "数据格式异常", "mods": [], "total": 0}

    # 搜索过滤
    q = search.strip().lower()
    if q:
        mods = [m for m in mods if
                q in (m.get("name", "") or "").lower() or
                q in (m.get("author", "") or "").lower() or
                q in (m.get("description", "") or "").lower() or
                q in (m.get("repo", "") or "").lower()]

    # 作者过滤
    if author:
        mods = [m for m in mods if (m.get("repo", "") or "").split("/")[0] == author]

    # 语言分类过滤
    if lang:
        if lang == "js":
            mods = [m for m in mods if m.get("hasScripts")]
        elif lang == "java":
            mods = [m for m in mods if m.get("hasJava")]
        elif lang == "both":
            mods = [m for m in mods if m.get("hasScripts") and m.get("hasJava")]
        elif lang == "none":
            mods = [m for m in mods if not m.get("hasScripts") and not m.get("hasJava")]

    # 排序
    if sort == "stars":
        mods.sort(key=lambda m: -(m.get("stars") or 0))
    elif sort == "name":
        mods.sort(key=lambda m: (m.get("name") or "").lower())
    elif sort == "updated":
        mods.sort(key=lambda m: m.get("lastUpdated") or "", reverse=True)
    else:
        mods.sort(key=lambda m: -(m.get("stars") or 0))

    # 分页
    total = len(mods)
    total_pages = max(1, -(-total // size))
    page = max(1, min(page, total_pages))
    start = (page - 1) * size
    page_items = mods[start:start + size]

    return {
        "mods": page_items,
        "total": total,
        "page": page,
        "size": size,
        "total_pages": total_pages,
        "_cached_age": int(cache_age) if cache_age else 0,
    }


@app.get("/api/mods/stats")
def get_mods_stats():
    """返回模组统计信息（作者分布、语言分类计数），轻量接口"""
    import time
    now = time.time()
    cache_data = None
    if os.path.exists(MODS_CACHE_FILE):
        try:
            with open(MODS_CACHE_FILE, "r", encoding="utf-8") as f:
                cache_data = json.load(f)
        except (json.JSONDecodeError, IOError):
            cache_data = None
    if cache_data is None:
        return {"error": "no cache", "authors": {}, "langs": {}}
    mods = cache_data if isinstance(cache_data, list) else cache_data.get("mods", [])
    if not isinstance(mods, list):
        return {"error": "invalid data", "authors": {}, "langs": {}}
    authors = {}
    js = java = both = none = 0
    for m in mods:
        a = (m.get("repo", "") or "").split("/")[0] or "unknown"
        authors[a] = authors.get(a, 0) + 1
        has_js = bool(m.get("hasScripts"))
        has_java = bool(m.get("hasJava"))
        if has_js and has_java:
            both += 1
        elif has_js:
            js += 1
        elif has_java:
            java += 1
        else:
            none += 1
    sorted_authors = dict(sorted(authors.items(), key=lambda x: -x[1]))
    return {
        "total": len(mods),
        "authors": sorted_authors,
        "langs": {"js": js, "java": java, "both": both, "none": none},
        "_cached_age": int(now - cache_data.get("_cached_at", 0)) if isinstance(cache_data, dict) else 0,
    }


# 所有全局状态和锁初始化完成后再启动 watcher，避免模块导入期间读取半初始化状态。
_start_env_watcher()
