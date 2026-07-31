#!/bin/bash
# ──────────────────────────────────────────────────────────
# IP 归属查询 API — 启动脚本
# 兼容 /root/GHWATCH 下 Python 环境，后台常驻运行
# ──────────────────────────────────────────────────────────

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 配置环境变量（可通过外部覆盖）
export IPAPI_HOST="${IPAPI_HOST:-127.0.0.1}"
export IPAPI_PORT="${IPAPI_PORT:-4001}"
export IPAPI_REDIS_URL="${IPAPI_REDIS_URL:-redis://127.0.0.1:6379/0}"
export IPAPI_MMDB_PATH="${IPAPI_MMDB_PATH:-/opt/1panel/apps/openresty/openresty/www/sites/api.www.eocc.top/index/data/ip/Merged-IP.mmdb}"

# 授权合作方密钥（JSON 数组格式）
# export PARTNER_KEYS='["prod-key-001","prod-key-002"]'

cd "$PROJECT_DIR" || exit 1

echo "[ipapi] 工作目录: $PROJECT_DIR"
echo "[ipapi] 监听地址: ${IPAPI_HOST}:${IPAPI_PORT}"

# ── 使用 Python 守护化启动器（比 nohup 更可靠） ──
python3 "$PROJECT_DIR/start_ipapi.py"
