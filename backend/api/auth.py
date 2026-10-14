"""Simple sign-in for the MVP: accounts come from the APP_USERS env var ("name:password,name2:password2").

When APP_USERS is empty, sign-in is off (local runs, CI) and every request is anonymous.
Tokens are HMAC-signed with AUTH_SECRET and expire after TOKEN_DAYS. Changing AUTH_SECRET signs everyone out.
Passwords live in the host's environment, not hashed in a database: fine for a few prototype users only.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Header, HTTPException

TOKEN_DAYS = 7
FAIL_DELAY_S = 1.5  # slows down password guessing
_FALLBACK_SECRET = secrets.token_hex(32)  # used when AUTH_SECRET is unset: sessions end at every restart


def users() -> dict[str, str]:
    out = {}
    for item in os.getenv("APP_USERS", "").split(","):
        name, sep, pw = item.strip().partition(":")
        if sep and name.strip() and pw:
            out[name.strip()] = pw
    return out


def enabled() -> bool:
    return bool(users())


def _secret() -> bytes:
    return (os.getenv("AUTH_SECRET") or _FALLBACK_SECRET).encode()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def issue(username: str, now: float | None = None) -> dict:
    exp = int((now or time.time()) + TOKEN_DAYS * 86400)
    body = _b64(json.dumps({"u": username, "exp": exp}).encode())
    sig = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    return {"token": f"{body}.{sig}", "username": username, "expires_at": exp}


def verify(token: str, now: float | None = None) -> str | None:
    """Username for a valid, unexpired token whose account still exists; otherwise None."""
    try:
        body, sig = token.split(".")
        good = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, good):
            return None
        data = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if data.get("exp", 0) < (now or time.time()) or data.get("u") not in users():
        return None
    return data["u"]


def check_password(username: str, password: str) -> bool:
    expected = users().get(username)
    # compare even when the user is unknown, so timing does not reveal which names exist
    ok = hmac.compare_digest(password.encode(), (expected or secrets.token_hex(16)).encode())
    return ok and expected is not None


def require_user(authorization: str | None = Header(default=None)) -> str | None:
    """FastAPI dependency: the signed-in username, or None when sign-in is off. 401 otherwise."""
    if not enabled():
        return None
    token = (authorization or "").removeprefix("Bearer ").strip()
    user = verify(token) if token else None
    if not user:
        raise HTTPException(401, "Bạn cần đăng nhập (hoặc phiên đăng nhập đã hết hạn).")
    return user
