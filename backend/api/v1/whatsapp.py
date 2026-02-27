import hashlib
import hmac
from fastapi import APIRouter, Request, HTTPException, Query

from app.config import settings

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """WhatsApp webhook verification (GET)."""
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook")
async def receive_webhook(request: Request):
    """Receive WhatsApp messages (POST)."""
    body = await request.body()

    # Verify signature if app secret is configured
    if settings.WHATSAPP_APP_SECRET:
        signature = request.headers.get("x-hub-signature-256", "")
        expected = "sha256=" + hmac.new(
            settings.WHATSAPP_APP_SECRET.encode(), body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
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
                text = ""

                if msg_type == "text":
                    text = message.get("text", {}).get("body", "")

                if text and from_number:
                    # Send to Celery for async processing
                    from workers.tasks import process_whatsapp_message
                    process_whatsapp_message.delay(from_number, text)

    return {"status": "ok"}
