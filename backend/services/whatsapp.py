import httpx
from app.config import settings

WHATSAPP_API_URL = "https://graph.facebook.com/v21.0"


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
            print(f"WhatsApp API error: {response.status_code} - {data}")
        return data


async def send_template_message(to: str, template_name: str, language: str = "ar") -> dict:
    """Send a template message via WhatsApp Cloud API."""
    url = f"{WHATSAPP_API_URL}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language},
        },
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        return response.json()


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
