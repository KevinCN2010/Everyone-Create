"""IP归属查询API — 全局配置"""

import os
import json

# ── 监听地址 ──────────────────────────────────────────────
LISTEN_HOST = os.getenv("IPAPI_HOST", "127.0.0.1")
LISTEN_PORT = int(os.getenv("IPAPI_PORT", "4001"))

# ── MMDB ──────────────────────────────────────────────────
MMDB_PATH = os.getenv(
    "IPAPI_MMDB_PATH",
    "/opt/1panel/apps/openresty/openresty/www/sites/api.www.eocc.top/index/data/ip/Merged-IP.mmdb",
)

# ── Redis ──────────────────────────────────────────────────
# 注意: 生产环境 Redis 容器默认端口为 6380，若使用该端口请设置环境变量:
#   export IPAPI_REDIS_URL=redis://127.0.0.1:6380/0
REDIS_URL = os.getenv("IPAPI_REDIS_URL", "redis://127.0.0.1:6379/0")

# ── 限流 ───────────────────────────────────────────────────
RATE_LIMIT_PER_MINUTE = int(os.getenv("IPAPI_RATE_LIMIT", "60"))

# ── 临时票据 ──────────────────────────────────────────────
TICKET_TTL_SECONDS = 300  # 5 分钟
TICKET_REDIS_PREFIX = "ipapi:ticket:"

# ── 授权合作方长期密钥 ────────────────────────────────────
# 格式: 环境变量 PARTNER_KEYS = JSON 数组 ["key1","key2",...]
# 安全提示: 生产环境应通过 1Panel 面板设置环境变量，切勿写在代码或 URL 中
_RAW = os.getenv("PARTNER_KEYS", '["test-partner-key-001"]')
PARTNER_KEYS: list[str] = json.loads(_RAW) if isinstance(json.loads(_RAW), list) else ["test-partner-key-001"]
