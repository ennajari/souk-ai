
from core.locale import normalize_phone as _normalize_phone
import httpx
from app.config import settings

WHATSAPP_API_URL = "https://graph.facebook.com/v22.0"


def normalize_phone(phone: str, country: str | None = "MA") -> str:
    """WhatsApp/E.164 digits. Single implementation lives in core.locale."""
    return _normalize_phone(phone, country)


async def send_text_message(to: str, text: str) -> dict:
    """Send a text message via WhatsApp Cloud API."""
    url = f"{WHATSAPP_API_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        data = response.json()
        if response.status_code != 200:
            print(f"[WhatsApp ERROR] {response.status_code} - to={to} - {data}")
            raise Exception(f"WhatsApp send failed: {data.get('error', {}).get('message', str(data))}")
        return data


async def send_template_message(
    to: str, template_name: str, language: str = "ar", body_params: list[str] | None = None
) -> dict:
    """Send a template message via WhatsApp Cloud API.

    body_params: list of text values for {{1}}, {{2}}, … placeholders in the template body.
    """
    url = f"{WHATSAPP_API_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    template: dict = {
        "name": template_name,
        "language": {"code": language},
    }
    if body_params:
        template["components"] = [
            {
                "type": "body",
                "parameters": [{"type": "text", "text": p} for p in body_params],
            }
        ]
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": template,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        data = response.json()
        if response.status_code != 200:
            raise Exception(f"WhatsApp template send failed: {data.get('error', {}).get('message', str(data))}")
        return data


async def send_otp_message(to: str, code: str) -> dict:
    """Send OTP via approved template (bypasses 24h window). Falls back to free-form text."""
    # Try template first — works even when user hasn't messaged in 24h
    try:
        return await send_template_message(
            to=to,
            template_name="reset_password_otp",
            language="fr",
            body_params=[code],
        )
    except Exception as template_err:
        print(f"[OTP] Template failed ({template_err}), trying free-form text...")

    # Fallback: plain text (only works within 24h window)
    return await send_text_message(
        to, f"Souk.AI - Code de reinitialisation: {code}\nCe code expire dans 10 minutes."
    )


async def send_document_message(to: str, document_bytes: bytes, filename: str, caption: str = "") -> dict:
    """Upload a PDF document and send it via WhatsApp Cloud API."""
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"}

    async with httpx.AsyncClient(timeout=60) as client:
        # Step 1: Upload media
        upload_url = f"{WHATSAPP_API_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/media"
        upload_resp = await client.post(
            upload_url,
            headers=headers,
            data={"messaging_product": "whatsapp"},
            files={"file": (filename, document_bytes, "application/pdf")},
        )
        upload_data = upload_resp.json()
        media_id = upload_data.get("id")
        if not media_id:
            return upload_data

        # Step 2: Send document message
        msg_url = f"{WHATSAPP_API_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "document",
            "document": {"id": media_id, "filename": filename, "caption": caption},
        }
        msg_resp = await client.post(
            msg_url, json=payload,
            headers={**headers, "Content-Type": "application/json"},
        )
        return msg_resp.json()


async def mark_as_read(message_id: str) -> dict:
    """Mark a message as read."""
    url = f"{WHATSAPP_API_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        return response.json()
