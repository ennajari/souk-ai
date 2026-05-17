"""Server-Sent Events broadcaster using Redis pub/sub."""

import asyncio
import json
from typing import AsyncGenerator

import redis.asyncio as aioredis
from app.config import settings

CHANNEL_PREFIX = "sse:"


async def publish_event(channel: str, event_type: str, data: dict):
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        payload = json.dumps({"event": event_type, "data": data})
        await r.publish(f"{CHANNEL_PREFIX}{channel}", payload)
    finally:
        await r.aclose()


async def subscribe(channel: str) -> AsyncGenerator[str, None]:
    r = aioredis.from_url(settings.REDIS_URL)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"{CHANNEL_PREFIX}{channel}")
    try:
        while True:
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if msg and msg["type"] == "message":
                raw = msg["data"]
                text = raw.decode("utf-8") if isinstance(raw, bytes) else raw
                parsed = json.loads(text)
                yield f"event: {parsed['event']}\ndata: {json.dumps(parsed['data'])}\n\n"
            else:
                yield ": heartbeat\n\n"
                await asyncio.sleep(15)
    finally:
        await pubsub.unsubscribe(f"{CHANNEL_PREFIX}{channel}")
        await pubsub.aclose()
        await r.aclose()
