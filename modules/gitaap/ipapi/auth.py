"""鉴权模块：长期密钥验证 & 临时票据生成/核销

分工：
- 长期密钥（X-Api-Token）：用于身份识别，换取临时票据
- 临时票据（X-Ticket）：一次性凭证，Redis GETDEL 原子操作防止并发重用
"""

import secrets
import time

import redis as _redis

from ipapi.config import (
    PARTNER_KEYS,
    REDIS_URL,
    TICKET_REDIS_PREFIX,
    TICKET_TTL_SECONDS,
)

# 延迟初始化 Redis 连接（避免模块导入时因 Redis 不可达而崩溃）
_r: _redis.Redis | None = None


def _get_redis() -> _redis.Redis:
    """获取 Redis 连接，首次调用时建立连接"""
    global _r
    if _r is None:
        _r = _redis.from_url(REDIS_URL, decode_responses=True)
    return _r


# ── 长期密钥 ──────────────────────────────────────────────


def verify_long_term_key(token: str) -> bool:
    """校验长期密钥是否合法"""
    return token in PARTNER_KEYS


# ── 临时票据 ──────────────────────────────────────────────


def _ticket_key(ticket: str) -> str:
    return f"{TICKET_REDIS_PREFIX}{ticket}"


def generate_ticket() -> str:
    """生成一次性临时票据，写入 Redis，返回票据字符串"""
    ticket = f"{secrets.token_hex(16)}"
    key = _ticket_key(ticket)
    _get_redis().setex(key, TICKET_TTL_SECONDS, "1")
    return ticket


def consume_ticket(ticket: str) -> bool:
    """核销临时票据（GETDEL 原子操作）

    返回 True 表示票据有效且成功使用；False 表示无效/已用/过期
    """
    key = _ticket_key(ticket)
    result = _get_redis().getdel(key)
    return result == "1"
