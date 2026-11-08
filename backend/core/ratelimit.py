"""Fixed-window rate limiting and attempt counters backed by Redis."""
import logging

import redis.asyncio as aioredis
from fastapi import HTTPException, Request

from app.config import settings

logger = logging.getLogger("souk_ai")
_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True, socket_timeout=2)
    return _redis


async def hit(key: str, limit: int, window_s: int) -> bool:
    """Count one hit; return True while the key is within `limit` hits per window.

    Fails open when Redis is down: availability of the till beats strict limiting.
    """
    try:
        r = get_redis()
        n = await r.incr(key)
        if n == 1:
            await r.expire(key, window_s)
        return n <= limit
    except Exception as e:  # noqa: BLE001
        logger.warning("rate limiter unavailable: %s", e)
        return True


def client_ip(request: Request) -> str:
    # Nginx sets X-Real-IP; never trust a client-supplied X-Forwarded-For first hop here.
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")


async def enforce(key: str, limit: int, window_s: int) -> None:
    if not await hit(f"rl:{key}", limit, window_s):
        raise HTTPException(429, "Trop de tentatives. Reessayez dans quelques minutes.")


async def reset(key: str) -> None:
    try:
        await get_redis().delete(f"rl:{key}")
    except Exception:  # noqa: BLE001
        pass
