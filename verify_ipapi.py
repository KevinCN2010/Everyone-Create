#!/usr/bin/env python3
"""
IP 归属查询 API — 综合验证脚本
直接运行:  python3 verify_ipapi.py
自动启动临时服务 → 测试全部端点 → 输出结果
"""

import sys
import os
import json
import threading
import time
import urllib.request
import urllib.error

# 确保能找到 ipapi 包
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ipapi.app import app
from werkzeug.serving import run_simple

PORT = 4001
BASE = f"http://127.0.0.1:{PORT}"


def start_server():
    t = threading.Thread(
        target=run_simple,
        args=("127.0.0.1", PORT, app),
        kwargs={"use_reloader": False, "threaded": True},
        daemon=True,
    )
    t.start()
    time.sleep(2)


def get(path, headers=None):
    req = urllib.request.Request(f"{BASE}{path}")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    resp = urllib.request.urlopen(req)
    return resp.status, json.loads(resp.read().decode())


def post(path, headers=None):
    req = urllib.request.Request(f"{BASE}{path}", data=b"", method="POST")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    resp = urllib.request.urlopen(req)
    return resp.status, json.loads(resp.read().decode())


def main():
    print("=" * 55)
    print("  IP 归属查询 API — 综合验证")
    print("=" * 55)

    # 清理遗留测试数据
    import redis as _redis_lib
    from ipapi.config import REDIS_URL
    _rc = _redis_lib.from_url(REDIS_URL, decode_responses=True)
    for key in _rc.scan_iter("ipapi:ratelimit:10.*"):
        _rc.delete(key)
    for key in _rc.scan_iter("ipapi:ratelimit:99.*"):
        _rc.delete(key)
    _rc.close()

    # ── 1. 模块导入 ──
    print("\n[1/6] 模块导入检查...")
    from ipapi.config import LISTEN_HOST, LISTEN_PORT, MMDB_PATH, REDIS_URL
    from ipapi.ipdb import lookup_ip
    from ipapi.auth import generate_ticket, consume_ticket
    from ipapi.ratelimit import check_rate_limit
    from ipapi.utils import normalize_ip, is_private_reserved
    print("  OK: 全部模块导入成功")
    print(f"  监听: {LISTEN_HOST}:{LISTEN_PORT}")
    print(f"  MMDB: {MMDB_PATH}")
    print(f"  Redis: {REDIS_URL}")

    # ── 2. 核心逻辑 ──
    print("\n[2/6] 核心逻辑验证...")
    assert normalize_ip("8.8.8.8") == "8.8.8.8"
    assert normalize_ip("invalid") is None
    assert normalize_ip("::1") == "::1"
    assert is_private_reserved("127.0.0.1") is True
    assert is_private_reserved("192.168.1.1") is True
    assert is_private_reserved("10.0.0.1") is True
    assert is_private_reserved("8.8.8.8") is False
    print("  OK: IP格式/内网检测")

    r = lookup_ip("8.8.8.8")
    assert r and r["country"] == "美国"
    r = lookup_ip("114.114.114.114")
    assert r and r["province"] == "江苏"
    r = lookup_ip("2400:3200::1")
    assert r and r["country"] == "中国"
    r = lookup_ip("127.0.0.1")
    assert r is None
    r = lookup_ip("192.168.1.1")
    assert r is None
    print("  OK: IP归属查询 & 内网拦截")

    ticket = generate_ticket()
    assert consume_ticket(ticket) is True
    assert consume_ticket(ticket) is False
    print("  OK: 票据生成/核销(GETDEL)")

    assert check_rate_limit("127.0.0.1") is True
    print("  OK: 限流检查")

    # ── 3. 启动服务 ──
    print("\n[3/6] 启动验证服务...")
    start_server()
    # 快速健康检查
    s, d = get("/api/health")
    assert s == 200 and d["data"]["status"] == "ok"
    print(f"  OK: 服务运行于 127.0.0.1:{PORT}")

    # ── 4. 匿名查询模式 ──
    print("\n[4/6] 匿名查询测试...")
    s, d = get("/?action=ip&addr=8.8.8.8")
    assert s == 200 and d["data"]["country"] == "美国"
    print(f"  [参数模式] GET /?action=ip&addr=8.8.8.8 -> 200 ({d['data']['country']})")

    s, d = get("/api/ip/114.114.114.114")
    assert s == 200 and d["data"]["province"] == "江苏"
    print(f"  [REST模式] GET /api/ip/114.114.114.114 -> 200 ({d['data']['province']})")

    s, d = get("/api/ip/2400:3200::1")
    assert s == 200
    print(f"  [IPv6]     GET /api/ip/2400:3200::1 -> 200 ({d['data']['country']})")

    try:
        get("/api/ip/192.168.1.1")
        assert False
    except urllib.error.HTTPError as e:
        assert e.code == 400
    print(f"  [内网拦截] GET /api/ip/192.168.1.1 -> 400")

    try:
        get("/api/ip/not-an-ip")
        assert False
    except urllib.error.HTTPError as e:
        assert e.code == 400
    print(f"  [无效IP]   GET /api/ip/not-an-ip -> 400")

    # ── 5. 票据鉴权模式 ──
    print("\n[5/6] 票据鉴权测试...")
    s, d = post("/api/ticket", {"X-Api-Token": "test-partner-key-001"})
    assert s == 200
    ticket = d["data"]["ticket"]
    print(f"  [换取票据] POST /api/ticket -> 200 ticket={ticket[:16]}...")

    s, d = get("/api/ip/8.8.8.8", {"X-Ticket": ticket})
    assert s == 200
    print(f"  [使用票据] GET /api/ip/8.8.8.8 (X-Ticket) -> 200")

    try:
        get("/api/ip/1.1.1.1", {"X-Ticket": ticket})
        assert False
    except urllib.error.HTTPError as e:
        assert e.code == 401
    print(f"  [防重用]   GET /api/ip/1.1.1.1 (same ticket) -> 401")

    try:
        post("/api/ticket", {"X-Api-Token": "invalid-key"})
        assert False
    except urllib.error.HTTPError as e:
        assert e.code == 401
    print(f"  [无效密钥] POST /api/ticket (invalid key) -> 401")

    try:
        post("/api/ticket")
        assert False
    except urllib.error.HTTPError as e:
        assert e.code == 401
    print(f"  [无凭证]   POST /api/ticket (no auth) -> 401")

    # ── 6. 限流测试 ──
    print("\n[6/6] 限流测试...")
    # 降低限流阈值临时测试逻辑
    import ipapi.ratelimit as rl
    orig_limit = rl.RATE_LIMIT_PER_MINUTE
    rl.RATE_LIMIT_PER_MINUTE = 3

    test_ip = "99.99.99.99"
    for i in range(3):
        ok = rl.check_rate_limit(test_ip)
        assert ok is True, f"第{i+1}次应放行"
    ok = rl.check_rate_limit(test_ip)
    assert ok is False, "第4次应受限"

    # 恢复
    rl.RATE_LIMIT_PER_MINUTE = orig_limit
    print(f"  OK: 限流逻辑验证通过 (3次放行/第4次拒绝)")

    # ── 汇总 ──
    print("\n" + "=" * 55)
    print("  全部验证通过！")
    print("=" * 55)
    return 0


if __name__ == "__main__":
    sys.exit(main())
