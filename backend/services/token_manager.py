"""Token 管理器 — 支持多 Token，自动选择剩余配额最多的 Token"""

import os
import hashlib
import time
import threading
import re
import requests


_TOKEN_PATTERN = re.compile(
    r'(ghp_|gho_|ghu_|ghs_|ghf_|github_pat_)[A-Za-z0-9_]{10,}'
)

def sanitize_log(msg):
    """脱敏日志中的 Token 字符串"""
    return _TOKEN_PATTERN.sub(
        lambda m: m.group(0)[:4] + '****' + m.group(0)[-4:], str(msg)
    )


class TokenManager:
    """管理多个 GitHub Token，每次返回剩余配额最多的 Token"""

    def __init__(self):
        self._lock = threading.Lock()
        self._token_names = {}
        self._tokens = self._load_tokens()
        self._rate_limits = {}
        self._token_expiry = {}
        self._last_refresh = 0
        self._refresh_interval = 120
        self._selection_cursor = 0

    def _load_tokens(self):
        self._token_names = {}
        tokens_str = os.getenv("GITHUB_TOKENS", "")
        raw_tokens = []
        if tokens_str.strip():
            raw_tokens = [t.strip() for t in tokens_str.split(",") if t.strip()]
        if not raw_tokens:
            single = os.getenv("GITHUB_TOKEN", "")
            if single.strip():
                raw_tokens = [single.strip()]
        result = []
        seen = set()
        for item in raw_tokens:
            if "=" in item:
                name, _, token = item.partition("=")
                name = name.strip()
                token = token.strip()
                if token and token not in seen:
                    self._token_names[token] = name
                    result.append(token)
                    seen.add(token)
            else:
                if item not in seen:
                    result.append(item)
                    seen.add(item)
        return result

    def get_token_name(self, token):
        return self._token_names.get(token) or self.mask_token(token)

    def get_all_tokens(self):
        with self._lock:
            return list(self._tokens)

    def get_cache_namespace(self):
        """返回不泄露 Token 的权限上下文标识，供响应缓存隔离使用。"""
        with self._lock:
            parts = [f"{token}:{bool(self._rate_limits.get(token, {}).get('invalid'))}"
                     for token in self._tokens]
        return hashlib.sha256("\0".join(parts).encode("utf-8")).hexdigest()[:16]

    def get_best_token(self):
        with self._lock:
            return self._select_token_locked(reserve=False)

    def acquire_token(self):
        """为一次真实的 GitHub 请求原子选择并预留 Token 配额。"""
        with self._lock:
            return self._select_token_locked(reserve=True)

    def _select_token_locked(self, reserve):
        candidates = []
        best_score = float("-inf")
        for token in self._tokens:
            info = self._rate_limits.get(token)
            if info and info.get("invalid"):
                continue
            remaining = info.get("remaining") if info else None
            # 新 Token 尚未检查时优先尝试；同配额 Token 使用轮询分流。
            score = float("inf") if remaining is None else remaining
            if score > best_score:
                best_score = score
                candidates = [token]
            elif score == best_score:
                candidates.append(token)
        if not candidates:
            return ""
        index = self._selection_cursor % len(candidates) if reserve else 0
        token = candidates[index]
        if reserve:
            self._selection_cursor += 1
            info = self._rate_limits.get(token)
            if info and isinstance(info.get("remaining"), int) and info["remaining"] > 0:
                info["remaining"] -= 1
        return token

    def update_rate_limit(self, token, remaining, limit, reset, expires_at=None):
        with self._lock:
            self._rate_limits[token] = {
                "remaining": remaining, "limit": limit,
                "reset": reset, "last_checked": time.time(), "invalid": False,
            }
            if expires_at is not None:
                self._token_expiry[token] = expires_at
            elif token not in self._token_expiry:
                self._token_expiry[token] = None

    def get_rate_limits(self):
        with self._lock:
            return {token: dict(info) for token, info in self._rate_limits.items()} if self._rate_limits else {}

    def refresh_rate_limits(self):
        """检查所有 Token 的速率限制（每个 Token 调用一次 /rate_limit），同时读取 PAT 过期时间"""
        with self._lock:
            now = time.time()
            if now - self._last_refresh < self._refresh_interval:
                return
            self._last_refresh = now
            tokens = list(self._tokens)
        for token in tokens:
            if not token:
                continue
            try:
                headers = {
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "GitAAP/1.0 (github-repo-monitor)",
                    "Authorization": f"Bearer {token}",
                }
                resp = requests.get("https://api.github.com/rate_limit", headers=headers, timeout=10)
                try:
                    if resp.ok:
                        data = resp.json()
                        core = data.get("resources", {}).get("core", {})
                        expires_at = resp.headers.get("X-GitHub-Token-Expires-At")
                        self.update_rate_limit(token, core.get("remaining", 0), core.get("limit", 0),
                                               core.get("reset", 0), expires_at=expires_at)
                    elif resp.status_code == 403 and resp.headers.get("X-RateLimit-Remaining") is not None:
                        self.update_rate_limit(
                            token,
                            int(resp.headers.get("X-RateLimit-Remaining", 0)),
                            int(resp.headers.get("X-RateLimit-Limit", 0)),
                            int(resp.headers.get("X-RateLimit-Reset", 0)),
                        )
                    elif resp.status_code in (401, 403):
                        with self._lock:
                            self._rate_limits[token] = {
                                "remaining": 0, "limit": 0, "reset": 0,
                                "last_checked": time.time(), "invalid": True,
                            }
                finally:
                    resp.close()
            except Exception as e:
                print(f"[TokenManager] 刷新 Token 速率限制失败: {sanitize_log(e)}")

    def has_token(self):
        with self._lock:
            return len(self._tokens) > 0 and any(t for t in self._tokens)

    def mask_token(self, token):
        if not token:
            return ""
        s = str(token).strip()
        if len(s) <= 8:
            return s[:4] + "****"
        return s[:4] + "****" + s[-4:]

    def get_all_token_info(self):
        best_token = self.get_best_token()
        with self._lock:
            result = []
            for token in self._tokens:
                info = self._rate_limits.get(token)
                expires_at = self._token_expiry.get(token)
                expires_str = expires_at if expires_at else None
                masked = self.mask_token(token)
                if masked == token:
                    # 运行时安全检查，防止脱敏失败泄露 token
                    print(f"[安全] mask_token 未正确脱敏！ token 长度={len(token)}, masked={masked}")
                    masked = token[:4] + "****" + token[-4:]
                result.append({
                    "name": self.get_token_name(token),
                    "masked": masked,
                    "remaining": info["remaining"] if info else 0,
                    "limit": info["limit"] if info else 0,
                    "reset": info["reset"] if info else 0,
                    "last_checked": info["last_checked"] if info else None,
                    "is_best": token == best_token,
                    "expires_at": expires_str,
                })
            return result

    def add_token(self, token, name=None):
        with self._lock:
            if token in self._tokens:
                return False
            self._tokens.append(token)
            self._rate_limits.pop(token, None)
            self._token_expiry.pop(token, None)
            if name:
                self._token_names[token] = name
            return True

    def reload_tokens(self, manual_tokens=None):
        with self._lock:
            env_tokens = self._load_tokens()
            manual_tokens = manual_tokens or {}
            for t, n in manual_tokens.items():
                if t not in env_tokens:
                    env_tokens.append(t)
                self._token_names[t] = n
            self._tokens = env_tokens
            self._rate_limits = {t: v for t, v in self._rate_limits.items() if t in self._tokens}
            self._token_expiry = {t: v for t, v in self._token_expiry.items() if t in self._tokens}
            self._last_refresh = 0
            self._selection_cursor = 0

    def get_token_names(self):
        with self._lock:
            return dict(self._token_names)
