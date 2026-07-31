"""缓存服务 — 带 TTL 的内存缓存（线程安全 + 防惊群）"""

import time
import threading
from collections import OrderedDict
import requests


_cache = OrderedDict()
_cache_lock = threading.Lock()


def _make_marker():
    """生成唯一请求标记，并通知等待相同 URL 的线程。"""
    return ("pending", threading.Event())


def cached_get(url, ttl=600):
    """带缓存的 GET 请求，返回 JSON 数据（线程安全 + 防惊群）"""
    namespace = token_manager.get_cache_namespace() if token_manager else "anonymous"
    cache_key = (namespace, url)
    marker = None
    while marker is None:
        pending_event = None
        with _cache_lock:
            entry = _cache.get(cache_key)
            if entry and entry[0] == "pending":
                pending_event = entry[1]
            elif entry:
                data, expiry = entry
                if time.time() < expiry:
                    _cache.move_to_end(cache_key)
                    return data
                del _cache[cache_key]

            if pending_event is None:
                marker = _make_marker()
                _cache[cache_key] = marker

        if pending_event is not None:
            if not pending_event.wait(timeout=30):
                with _cache_lock:
                    current_entry = _cache.get(cache_key)
                    if current_entry is not None and current_entry[0] == "pending" and current_entry[1] is pending_event:
                        del _cache[cache_key]
                    elif current_entry is not None and current_entry[0] != "pending":
                        return current_entry[0]

    resp = None
    try:
        resp = requests.get(url, headers=get_github_headers(), timeout=15)
        if not resp.ok:
            print(f"[cached_get] {url} failed: {resp.status_code}")
            with _cache_lock:
                if _cache.get(cache_key) == marker:
                    del _cache[cache_key]
                marker[1].set()
            return None
        try:
            data = resp.json()
        except ValueError:
            print(f"[cached_get] {url} invalid JSON: status={resp.status_code}")
            with _cache_lock:
                if _cache.get(cache_key) == marker:
                    del _cache[cache_key]
                marker[1].set()
            return None
        with _cache_lock:
            if _cache.get(cache_key) == marker:
                if len(_cache) >= 500:
                    evict_count = max(5, len(_cache) - 500 + 1)
                    keys_to_remove = []
                    for old_url, old_entry in _cache.items():
                        if old_url != cache_key and old_entry[0] != "pending":
                            keys_to_remove.append(old_url)
                        if len(keys_to_remove) >= evict_count:
                            break
                    for key_to_remove in keys_to_remove:
                        del _cache[key_to_remove]
                _cache[cache_key] = (data, time.time() + ttl)
            marker[1].set()
        return data
    except Exception as e:
        print(f"[cached_get] {url} error: {e}")
        with _cache_lock:
            if _cache.get(cache_key) == marker:
                del _cache[cache_key]
            marker[1].set()
        return None
    finally:
        if resp is not None:
            resp.close()


def get_github_headers():
    """构造 GitHub API 请求头"""
    global token_manager
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "GitAAP/1.0 (github-repo-monitor)"
    }
    if token_manager:
        token = token_manager.acquire_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"
    return headers


# 全局实例（延迟初始化，避免循环导入）
token_manager = None

def init_token_manager(tm):
    global token_manager
    token_manager = tm


def clear_cache():
    """Token 或权限上下文变化时清空 GitHub 响应缓存。"""
    with _cache_lock:
        for entry in _cache.values():
            if entry[0] == "pending":
                entry[1].set()
        _cache.clear()


def cache_stats():
    """返回缓存条目统计，供管理面板展示（避免外部访问私有 _cache）。"""
    with _cache_lock:
        total = len(_cache)
        pending = sum(1 for entry in _cache.values() if entry[0] == "pending")
    return {"total": total, "pending": pending, "ready": total - pending}


def store_internal(key, data, ttl=300):
    """存储非 HTTP 请求结果到缓存（供内部函数使用）"""
    namespace = "internal"
    cache_key = (namespace, key)
    expiry = time.time() + ttl
    with _cache_lock:
        if len(_cache) >= 500:
            keys_to_remove = []
            for old_key, old_entry in _cache.items():
                if old_key != cache_key and old_entry[0] != "pending":
                    keys_to_remove.append(old_key)
                if len(keys_to_remove) >= max(3, 500 - len(_cache) + 1):
                    break
            for k in keys_to_remove:
                del _cache[k]
        _cache[cache_key] = (data, expiry)
