"""辅助工具函数"""

import os
import hashlib
from urllib.parse import unquote


def find_dotenv(candidates=None):
    """查找第一个存在的 .env 文件路径"""
    if candidates is None:
        candidates = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '.env'),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'),
            '/app/.env',
            os.path.join(os.getcwd(), '.env'),
        ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None


def _strip_inline_comment(value):
    """移除值末尾的行内注释（# 前有空格才视为注释，引号内的 # 不受影响）"""
    stripped = value.strip()
    # 只处理未被引号包裹的值中的行内注释
    if stripped and not (stripped.startswith('"') or stripped.startswith("'")):
        idx = stripped.find(' #')
        if idx >= 0:
            stripped = stripped[:idx].strip()
    return stripped


def load_dotenv(dotenv_path):
    """解析 .env 文件并设置到 os.environ，返回签名"""
    if not dotenv_path or not os.path.exists(dotenv_path):
        return None
    with open(dotenv_path, 'r', encoding='utf-8') as f:
        content = f.read()
    sig_lines = [l.strip() for l in content.splitlines() if l.strip() and not l.strip().startswith('#')]
    sig = hashlib.md5('\n'.join(sig_lines).encode()).hexdigest()
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        else:
            value = _strip_inline_comment(value)
        if key:
            os.environ[key] = value
    return sig


def decode_path(path):
    """URL 解码路径"""
    try:
        return unquote(path)
    except Exception:
        return path
