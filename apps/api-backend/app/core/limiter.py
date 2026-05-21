from slowapi import Limiter
from slowapi.util import get_remote_address


def _get_real_ip(request) -> str:
    """Prefer X-Forwarded-For (set by reverse proxy) over direct client IP."""
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_get_real_ip)
