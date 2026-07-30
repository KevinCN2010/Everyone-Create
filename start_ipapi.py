#!/usr/bin/env python3
"""IP 归属查询 API — 守护化启动器

在 nohup/setsid 无法正常工作的环境中，
使用 Python subprocess.Popen(start_new_session=True) 确保进程完全脱离终端。
"""

import subprocess
import sys
import os

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
LOG_FILE = os.path.join(LOG_DIR, "ipapi.log")
PID_FILE = os.path.join(LOG_DIR, "ipapi.pid")

os.makedirs(LOG_DIR, exist_ok=True)

proc = subprocess.Popen(
    [sys.executable, "-m", "ipapi.app"],
    stdout=open(LOG_FILE, "a"),
    stderr=subprocess.STDOUT,
    stdin=subprocess.DEVNULL,
    start_new_session=True,
)

with open(PID_FILE, "w") as f:
    f.write(str(proc.pid))

print(f"[ipapi] 已启动，PID: {proc.pid}")
print(f"[ipapi] 日志: {LOG_FILE}")
print(f"[ipapi] 查看日志: tail -f {LOG_FILE}")
