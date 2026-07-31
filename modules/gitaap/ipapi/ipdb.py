"""MMDB 全局加载与 IP 查询

设计原则：
- 进程启动时一次性将 MMDB 读入内存，进程生命周期内复用同一个 Reader
- 查询结果以统一 dict 形式返回，降低上层耦合
- `init()` 需在程序入口处显式调用（非模块导入即加载），以便控制加载时机
"""

import maxminddb
from ipapi.config import MMDB_PATH
from ipapi.utils import is_private_reserved, normalize_ip

_reader: maxminddb.Reader | None = None


def init() -> None:
    """显式初始化：加载 MMDB 到内存。程序入口处调用"""
    global _reader
    path = MMDB_PATH
    try:
        _reader = maxminddb.open_database(path, maxminddb.MODE_MEMORY)
    except FileNotFoundError:
        raise RuntimeError(f"MMDB 文件不存在: {path}")
    except Exception as exc:
        raise RuntimeError(f"MMDB 加载失败: {exc}")


def get_reader() -> maxminddb.Reader:
    global _reader
    if _reader is None:
        init()
    return _reader


def lookup_ip(ip_str: str) -> dict | None:
    """查询 IP 归属信息

    参数:
        ip_str: 待查询的 IP 字符串

    返回:
        规范化后的 IP + geo 信息 dict；内网 / 无效 IP 返回 None
    """
    if _reader is None:
        raise RuntimeError("MMDB 未初始化，请先调用 ipdb.init()")

    ip = normalize_ip(ip_str)
    if ip is None:
        return None

    if is_private_reserved(ip):
        return None

    raw = _reader.get(ip)
    if raw is None:
        return {"ip": ip, "country": None, "province": None, "city": None}

    def _get_name(data, default=None):
        if data is None:
            return default
        if isinstance(data, str):
            return data
        names = None
        if isinstance(data, dict):
            names = data.get("names")
        if names is None:
            return default
        return names.get("zh-CN") or names.get("en", default)

    country = _get_name(raw.get("country"))
    subdivisions = raw.get("subdivisions", [])
    province = _get_name(subdivisions[0]) if subdivisions else None
    city = _get_name(raw.get("city"))

    return {
        "ip": ip,
        "country": country,
        "province": province,
        "city": city,
    }
