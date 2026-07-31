"""Redis 限流：滑动窗口计数器（单 IP 维度）

思路：
- 以 IP 为 key，存储当前分钟的时间戳列表（秒级精度）
- 每次请求清理 >60s 的旧时间戳，检查列表长度是否超限
- 使用 Lua 脚本保证原子性（或使用 redis-py pipeline）
"""

import time
import redis as _redis

from ipapi.config import REDIS_URL, RATE_LIMIT_PER_MINUTE

_r = _redis.from_url(REDIS_URL, decode_responses=True)

# Lua 脚本 — 滑动窗口限流原子操作
_LUA_RATE_LIMIT = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])       -- 每窗口上限
local window = tonumber(ARGV[2])      -- 窗口大小（秒）
local now = tonumber(ARGV[3])

-- 移除窗口外的旧记录
redis.call("ZREMRANGEBYSCORE", key, 0, now - window)

-- 当前窗口计数
local count = redis.call("ZCARD", key)
if count >= limit then
    return 0  -- 拒绝
end

-- 记录本次请求，设置 TTL 避免内存泄漏
redis.call("ZADD", key, now, now .. ":" .. math.random())
redis.call("EXPIRE", key, window * 2)
return 1     -- 放行
"""

# 脚本注册（做一次，Redis 不可达时延迟到首次调用时再尝试）
_SCRIPT_HASH: str | None = None


def _ensure_script() -> str | None:
    """确保 Lua 脚本已注册到 Redis，返回 hash 或 None（Redis 不可用）"""
    global _SCRIPT_HASH
    if _SCRIPT_HASH is not None:
        return _SCRIPT_HASH
    try:
        _SCRIPT_HASH = _r.script_load(_LUA_RATE_LIMIT)
        return _SCRIPT_HASH
    except _redis.RedisError:
        return None


def check_rate_limit(client_ip: str) -> bool:
    """检查是否超出限流

    返回 True = 放行；False = 拒绝（限流触发）
    """
    if RATE_LIMIT_PER_MINUTE <= 0:
        return True  # 不限流

    sha = _ensure_script()
    if sha is None:
        # Redis 不可用，降级为放行（避免因 Redis 故障导致服务不可用）
        return True

    now = int(time.time())
    key = f"ipapi:ratelimit:{client_ip}"
    ok = _r.evalsha(sha, 1, key, RATE_LIMIT_PER_MINUTE, 60, now)
    return bool(ok)
