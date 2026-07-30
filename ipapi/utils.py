"""IP 工具函数：格式校验、内网/保留段检测"""

import ipaddress


def normalize_ip(raw: str) -> str | None:
    """尝试将字符串解析为合法 IP（v4/v6），返回规范化形式或 None"""
    raw = raw.strip()
    if not raw:
        return None
    try:
        obj = ipaddress.ip_address(raw)
        return str(obj)
    except ValueError:
        return None


# 内网 / 保留地址段（CIDR 列表）
_PRIVATE_NETS = [
    ipaddress.ip_network("0.0.0.0/8"),          # 当前网络（RFC 1122 §3.2.1.3）
    ipaddress.ip_network("10.0.0.0/8"),          # RFC 1918
    ipaddress.ip_network("127.0.0.0/8"),         # 回环
    ipaddress.ip_network("169.254.0.0/16"),      # 链路本地
    ipaddress.ip_network("172.16.0.0/12"),       # RFC 1918
    ipaddress.ip_network("192.168.0.0/16"),      # RFC 1918
    ipaddress.ip_network("224.0.0.0/4"),         # 组播
    ipaddress.ip_network("240.0.0.0/4"),         # 保留
    ipaddress.ip_network("255.255.255.255/32"),  # 受限广播
    # IPv6
    ipaddress.ip_network("::1/128"),             # 回环
    ipaddress.ip_network("fc00::/7"),            # 唯一本地地址（ULA）
    ipaddress.ip_network("fe80::/10"),           # 链路本地
    ipaddress.ip_network("ff00::/8"),            # 组播
]


def is_private_reserved(ip_str: str) -> bool:
    """检查 IP 是否属于内网或保留地址段"""
    try:
        obj = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # 无法解析，直接拒绝
    for net in _PRIVATE_NETS:
        if obj in net:
            return True
    return False
