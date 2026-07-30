"""
应用启动器 — 启动时自动编译检测 + 错误隔离 + 日志记录
=====================================================
每次启动时扫描 backend/ 下所有 .py 文件并尝试编译。
任一文件编译失败 → 记录详细错误到 logs/startup.errors.log → 继续启动主程序。
不会因为某个模块的编译错误而阻止整个应用启动。
"""

import os
import sys
import py_compile
from datetime import datetime, timezone

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
ERROR_LOG = os.path.join(LOG_DIR, "startup.errors.log")


def _ensure_log_dir():
    """确保日志目录存在"""
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR, exist_ok=True)


def _scan_py_files(root_dir):
    """递归扫描目录下所有 .py 文件"""
    py_files = []
    for dirpath, _, filenames in os.walk(root_dir):
        for f in filenames:
            if f.endswith(".py"):
                py_files.append(os.path.join(dirpath, f))
    return sorted(py_files)


def _check_py_file(filepath):
    """编译检查单个 .py 文件，返回 (文件名, 是否成功, 错误信息)"""
    try:
        py_compile.compile(filepath, doraise=True)
        return (filepath, True, None)
    except py_compile.PyCompileError as e:
        return (filepath, False, str(e))
    except Exception as e:
        return (filepath, False, f"{type(e).__name__}: {e}")


def run_startup_checks():
    """
    执行启动前检查：
    1. 扫描所有 .py 文件
    2. 逐个编译检查
    3. 记录错误到日志文件
    4. 返回 (total, failed, errors)
    """
    _ensure_log_dir()
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    py_files = _scan_py_files(backend_dir)

    # 也检查主入口文件（在父目录中）
    main_py = os.path.join(os.path.dirname(backend_dir), "i18n", "main.py")
    if os.path.exists(main_py):
        py_files.insert(0, main_py)

    if not py_files:
        print("[startup] 未找到需要检查的 .py 文件")
        return (0, 0, [])

    print(f"[startup] 正在检查 {len(py_files)} 个 Python 文件...")
    failed_results = []

    for fp in py_files:
        relpath = os.path.relpath(fp, os.path.dirname(backend_dir))
        fname, ok, err = _check_py_file(fp)
        if ok:
            print(f"  ✅ {relpath}")
        else:
            print(f"  ❌ {relpath}: {err}")
            failed_results.append((relpath, err))

    if failed_results:
        timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
        with open(ERROR_LOG, 'a', encoding='utf-8') as f:
            f.write(f"\n{'='*60}\n")
            f.write(f"Startup Check — {timestamp}\n")
            f.write(f"{'='*60}\n")
            for relpath, err in failed_results:
                f.write(f"\n[FAIL] {relpath}\n")
                f.write(f"Error: {err}\n")
        print(f"\n[startup] ⚠️  {len(failed_results)} 个文件编译失败，详情已记录到 {ERROR_LOG}")
    else:
        print(f"\n[startup] ✅ 全部 {len(py_files)} 个文件编译通过")

    return (len(py_files), len(failed_results), failed_results)
