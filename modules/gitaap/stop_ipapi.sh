#!/bin/bash
# ──────────────────────────────────────────────────────────
# IP 归属查询 API — 停止脚本
# ──────────────────────────────────────────────────────────
PID_FILE="/root/gitaap/logs/ipapi.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill "$PID" 2>/dev/null; then
        echo "[ipapi] 已停止进程 $PID"
    else
        echo "[ipapi] 进程 $PID 不存在，可能已停止"
    fi
    rm -f "$PID_FILE"
else
    # 尝试按名称查找
    PID=$(pgrep -f "ipapi.app" 2>/dev/null | head -1)
    if [ -n "$PID" ]; then
        kill "$PID"
        echo "[ipapi] 已停止进程 $PID (按名称匹配)"
    else
        echo "[ipapi] 未找到运行中的 ipapi 进程"
    fi
fi
