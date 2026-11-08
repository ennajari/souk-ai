import hashlib
import hmac
import logging
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from app.config import settings
from core.ratelimit import get_redis

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
logger = logging.getLogger("souk_ai")


async def _is_duplicate(message_id: str) -> bool:
    """True if this WhatsApp message ID was already seen. Atomic (SET NX) so concurrent retries can't both pass."""
    if not message_id:
        return False
    try:
        # 24 h: Meta retries failed deliveries for up to a day
        return not await get_redis().set(f"wamid:{message_id}", "1", nx=True, ex=86400)
    except Exception:  # noqa: BLE001
        return False  # Redis down: better a rare duplicate than dropping merchant messages


def _signature_ok(body: bytes, signature: str) -> bool:
    if not settings.WHATSAPP_APP_SECRET:
        # Without the app secret anyone could post fake merchant messages (= fake sales/prices).
        return not settings.is_production
    expected = "sha256=" + hmac.new(settings.WHATSAPP_APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)


@router.get("/webhook")
async def verify_webhook(
    hub_mode: Annotated[str | None, Query(alias="hub.mode")] = None,
    hub_verify_token: Annotated[str | None, Query(alias="hub.verify_token")] = None,
    hub_challenge: Annotated[str | None, Query(alias="hub.challenge")] = None,
):
    """WhatsApp webhook verification (GET)."""
    if (
        hub_mode == "subscribe"
        and settings.WHATSAPP_VERIFY_TOKEN
        and hmac.compare_digest(hub_verify_token or "", settings.WHATSAPP_VERIFY_TOKEN)
    ):
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def receive_webhook(request: Request):
    """Receive WhatsApp messages (POST)."""
    body = await request.body()

    if not _signature_ok(body, request.headers.get("x-hub-signature-256", "")):
        logger.warning("whatsapp webhook rejected: bad or missing signature")
        raise HTTPException(status_code=403, detail="Invalid signature")

    payload = await request.json()

    # Extract messages from WhatsApp Cloud API payload
    entries = payload.get("entry", [])
    for entry in entries:
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages", [])
            for message in messages:
                from_number = message.get("from", "")
                msg_type = message.get("type", "")

                message_id = message.get("id", "")
                if await _is_duplicate(message_id):
                    continue  # WhatsApp duplicate delivery — skip silently

                if msg_type == "text":
                    text = message.get("text", {}).get("body", "")
                    if text and from_number:
                        from workers.tasks import process_whatsapp_message
                        process_whatsapp_message.delay(from_number, text)

                elif msg_type == "audio":
                    media_id = message.get("audio", {}).get("id", "")
                    if media_id and from_number:
                        from workers.tasks import process_whatsapp_voice_message
                        process_whatsapp_voice_message.delay(from_number, media_id)

                elif msg_type == "image":
                    media_id = message.get("image", {}).get("id", "")
                    caption = message.get("image", {}).get("caption", "")
                    if media_id and from_number:
                        from workers.tasks import process_whatsapp_image_message
                        process_whatsapp_image_message.delay(from_number, media_id, caption)

                elif msg_type == "document":
                    doc = message.get("document", {})
                    media_id = doc.get("id", "")
                    filename = doc.get("filename", "")
                    doc.get("mime_type", "")
                    if media_id and from_number and filename.lower().endswith(('.csv', '.txt')):
                        from workers.tasks import process_whatsapp_document
                        process_whatsapp_document.delay(from_number, media_id, filename)

    return {"status": "ok"}
