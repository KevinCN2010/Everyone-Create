"""IP 归属查询 API — Flask 主应用

路由清单：
  GET  /             调试信息页（默认）/ 参数模式：?action=ip&addr=<IP>
  GET  /api/ip/<IP>  REST 路径模式
  POST /api/ticket   长期密钥换临时票据
  GET  /api/health   健康检查

鉴权方式（按优先级）：
  1. 请求头 X-Ticket    -> 临时票据鉴权（一次有效，Redis GETDEL）
  2. 请求头 X-Api-Token -> 长期密钥鉴权（仅限换取票据）
  3. 无凭证             -> 匿名访问（限流 60/min）


安全提示：
  代码中通过 GET 参数 ?token=xxx 传递长期密钥仅作为本地临时调试手段，
  正式业务禁止在 URL 中以明文方式携带长期密钥，必须使用请求头传递。
"""

import sys
import os
import time

# 确保项目根目录在 sys.path 中
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from flask import Flask, request, jsonify, render_template_string

from ipapi.config import LISTEN_HOST, LISTEN_PORT, PARTNER_KEYS, MMDB_PATH, REDIS_URL, RATE_LIMIT_PER_MINUTE
from ipapi.ipdb import lookup_ip, init as ipdb_init, _reader
from ipapi.auth import verify_long_term_key, generate_ticket, consume_ticket
from ipapi.ratelimit import check_rate_limit, _r

app = Flask(__name__)

# 程序启动时全局加载 MMDB（模块导入即完成，全进程复用同一个实例）
ipdb_init()


# ── 辅助 ──────────────────────────────────────────────────


def _get_client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"


def _resolve_target_ip() -> str | None:
    # 1) REST 路径模式（由路由捕获）
    path = request.path
    if path.startswith("/api/ip/"):
        raw = path.removeprefix("/api/ip/").strip("/")
        if raw:
            return raw
    # 2) GET 参数
    addr = request.args.get("addr")
    if addr:
        return addr
    # 3) 来访客户端 IP
    return _get_client_ip()


def _get_auth_token() -> str | None:
    token = request.headers.get("X-Api-Token")
    if token:
        return token
    # ⚠️ GET 参数 token 仅限本地调试使用
    token = request.args.get("token")
    if token:
        return token
    return None


def _get_ticket() -> str | None:
    return request.headers.get("X-Ticket") or None


def json_ok(data: dict, status: int = 200):
    return jsonify({"code": status, "data": data}), status


def json_err(message: str, status: int = 400):
    return jsonify({"code": status, "message": message}), status


# ── 路由: 根路径调试信息页 ─────────────────────────────


_DEBUG_PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IP 归属查询 API — 调试信息</title>
<style>
body { font-family: 'Courier New', monospace; background: #1a1a2e; color: #e0e0e0; margin: 0; padding: 20px; }
h1 { color: #00d4aa; border-bottom: 2px solid #00d4aa; padding-bottom: 8px; }
h2 { color: #e94560; font-size: 16px; margin-top: 24px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
td, th { padding: 6px 12px; text-align: left; border-bottom: 1px solid #333; }
td:first-child { color: #888; width: 200px; white-space: nowrap; }
td:last-child { color: #fff; word-break: break-all; }
.warn { color: #ffd700; }
.danger { color: #e94560; }
.ok { color: #00d4aa; }
.info { color: #64b5f6; }
.section { background: #16213e; border-radius: 8px; padding: 12px 16px; margin: 12px 0; }
.note { font-size: 12px; color: #888; margin-top: 20px; padding: 8px 12px; background: #0f0f23; border-radius: 4px; border-left: 3px solid #e94560; }
</style>
</head>
<body>
<h1>IP 归属查询 API 调试面板</h1>

<div class="section">
<h2>服务状态</h2>
<table>
<tr><td>Service</td><td class="ok">Running</td></tr>
<tr><td>Server Time</td><td>{{ server_ts }} ({{ server_time }})</td></tr>
<tr><td>Uptime (process)</td><td>{{ uptime }}</td></tr>
<tr><td>MMDB File</td><td>{{ mmdb_path }}<br>Loaded: {{ mmdb_status }}</td></tr>
<tr><td>Redis</td><td>{{ redis_url }}<br>Status: {{ redis_status }}</td></tr>
<tr><td>Rate Limit</td><td>{{ rate_limit }} req/min per IP</td></tr>
<tr><td>Partner Keys</td><td>{{ partner_keys }} 个已注册</td></tr>
</table>
</div>

<div class="section">
<h2>请求者信息</h2>
<table>
<tr><td>Your IP</td><td class="info">{{ client_ip }}</td></tr>
<tr><td>Blacklisted</td><td class="ok">{{ blacklisted }}</td></tr>
<tr><td>Request Method</td><td>{{ method }}</td></tr>
<tr><td>Request URI</td><td>{{ uri }}</td></tr>
<tr><td>User-Agent</td><td>{{ ua }}</td></tr>
<tr><td>X-Forwarded-For</td><td>{{ xff }}</td></tr>
</table>
</div>

<div class="section">
<h2>凭证信息</h2>
<table>
{% if token %}
<tr><td>X-Api-Token</td><td class="danger">{{ token }}<br><span class="warn">你的 Token 被看见了！不要在 URL 或非安全通道中传递密钥。</span></td></tr>
{% else %}
<tr><td>X-Api-Token</td><td>(未提供)</td></tr>
{% endif %}
{% if ticket %}
<tr><td>X-Ticket</td><td class="danger">{{ ticket }}<br><span class="warn">你的票据被看见了！</span></td></tr>
{% else %}
<tr><td>X-Ticket</td><td>(未提供)</td></tr>
{% endif %}
<tr><td>调试 token (GET)</td><td>{{ get_token }}</td></tr>
</table>
</div>

<div class="section">
<h2>请求头</h2>
<table>
{% for key, value in headers %}
<tr><td>{{ key }}</td><td>{{ value }}</td></tr>
{% endfor %}
</table>
</div>

<div class="note">
<strong>安全提示：</strong> 本页面仅供调试使用。正式业务请勿在 URL 中明文传递密钥。
如需查询 IP，请使用 <code>GET /?action=ip&amp;addr=8.8.8.8</code> 或 <code>GET /api/ip/8.8.8.8</code>。
</div>
</body>
</html>"""


@app.route("/", methods=["GET"])
def handle_root():
    """根路径：无参数时显示调试信息页，有参数时查询 IP"""
    # 如果带了 action=ip 查询参数，走 IP 查询
    action = request.args.get("action")
    if action == "ip" or request.args.get("addr"):
        return _handle_ip_query(None)
    if action:
        return json_err(f"不支持的操作: {action}", 400)

    # 否则显示调试信息页
    client_ip = _get_client_ip()
    token = _get_auth_token()
    ticket = _get_ticket()

    # Redis 状态检测
    try:
        _r.ping()
        redis_status = "Connected"
    except Exception:
        redis_status = "Disconnected"

    # MMDB 状态检测
    mmdb_status = "Loaded" if _reader is not None else "Not Loaded"

    # 收集请求头
    headers = []
    seen = set()
    for k, v in sorted(request.headers.items()):
        key_lower = k.lower()
        if key_lower not in seen:
            seen.add(key_lower)
            headers.append((k, v))

    now = int(time.time())

    return render_template_string(
        _DEBUG_PAGE_TEMPLATE,
        server_ts=now,
        server_time=time.strftime("%Y-%m-%d %H:%M:%S %Z", time.localtime(now)),
        uptime=f"{round(time.monotonic())}s",
        mmdb_path=MMDB_PATH,
        mmdb_status=mmdb_status,
        redis_url=REDIS_URL,
        redis_status=redis_status,
        rate_limit=RATE_LIMIT_PER_MINUTE,
        partner_keys=len(PARTNER_KEYS),
        client_ip=client_ip,
        blacklisted="No",
        method=request.method,
        uri=request.full_path,
        ua=request.headers.get("User-Agent", "(none)"),
        xff=request.headers.get("X-Forwarded-For", "(none)"),
        token=token or "(未提供)",
        ticket=ticket or "(未提供)",
        get_token=request.args.get("token", "(未提供)"),
        headers=headers,
    )


# ── 路由: IP 归属查询 ─────────────────────────────────────


@app.route("/api/ip/<path:ip_addr>", methods=["GET"])
def handle_rest_query(ip_addr: str):
    """REST 路径模式：/api/ip/<IP>"""
    return _handle_ip_query(ip_addr.rstrip("/"))


@app.route("/api/ip/", methods=["GET"])
def handle_rest_query_empty():
    """REST 路径模式：/api/ip/ 无 IP — 默认查来访者 IP"""
    return _handle_ip_query(None)


def _handle_ip_query(target_ip: str | None):
    """IP 归属查询核心逻辑（匿名 / Ticket 鉴权双模式）"""

    # 1) 鉴权 & 限流
    ticket = _get_ticket()
    if ticket:
        if not consume_ticket(ticket):
            return json_err("临时票据无效或已过期", 401)
    else:
        client_ip = _get_client_ip()
        if not check_rate_limit(client_ip):
            return json_err("超出访问频率限制，请稍后再试", 429)

    # 2) 解析目标 IP
    if target_ip:
        # REST 路径捕获到了 IP 段
        target = target_ip.rstrip("/") or _get_client_ip()
    elif request.path.startswith("/api/ip/"):
        # /api/ip/ 路径（空段由 handle_rest_query_empty 传入 None）
        target = _get_client_ip()
    else:
        # 根路径参数模式
        target = request.args.get("addr") or _get_client_ip()

    if not target:
        return json_err("缺少 IP 地址参数", 400)

    # 3) 查询
    result = lookup_ip(target)

    if result is None:
        from ipapi.utils import normalize_ip
        if normalize_ip(target) is not None:
            return json_err("内网/保留地址不允许查询", 400)
        return json_err("IP 地址格式无效", 400)

    return json_ok(result)


# ── 路由: 换取临时票据 ──────────────────────────────────


@app.route("/api/ticket", methods=["POST"])
def handle_ticket():
    """长期密钥 → 临时票据"""
    token = _get_auth_token()
    if not token:
        return json_err("缺少凭证（请求头 X-Api-Token）", 401)

    if not verify_long_term_key(token):
        return json_err("长期密钥无效", 401)

    ticket = generate_ticket()
    return json_ok({"ticket": ticket, "expire_seconds": 300})


# ── 健康检查 ──────────────────────────────────────────────


@app.route("/api/health", methods=["GET"])
def health():
    return json_ok({"status": "ok"})


# ── 入口 ──────────────────────────────────────────────────


def main():
    print(f"[ipapi] 启动 → {LISTEN_HOST}:{LISTEN_PORT}")
    print(f"[ipapi] Redis : {__import__('ipapi.config').config.REDIS_URL}")

    # 程序启动时全局加载 MMDB
    ipdb_init()
    print(f"[ipapi] MMDB 已加载: {__import__('ipapi.config').config.MMDB_PATH}")
    print(f"[ipapi] 合作方: {len(__import__('ipapi.config').config.PARTNER_KEYS)} 个密钥已注册")

    from gevent.pywsgi import WSGIServer
    log_target = None
    if os.getenv("IPAPI_QUIET"):
        log_target = open("/dev/null", "w")
    server = WSGIServer((LISTEN_HOST, LISTEN_PORT), app, log=log_target)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[ipapi] 已关闭")


if __name__ == "__main__":
    main()
