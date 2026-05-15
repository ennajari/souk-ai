import httpx
import tempfile
import os
from openai import AsyncOpenAI
from app.config import settings

WHATSAPP_API_URL = "https://graph.facebook.com/v22.0"


async def download_whatsapp_media(media_id: str) -> bytes:
    """Download media from WhatsApp Cloud API by media ID."""
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"}

    async with httpx.AsyncClient() as client:
        url_resp = await client.get(f"{WHATSAPP_API_URL}/{media_id}", headers=headers)
        url_resp.raise_for_status()
        media_url = url_resp.json().get("url")

        media_resp = await client.get(media_url, headers=headers)
        media_resp.raise_for_status()
        return media_resp.content


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.ogg") -> str:
    """Transcribe audio using OpenAI Whisper API with auto language detection."""
    if not settings.OPENAI_API_KEY:
        return ""

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    tmp_path = None
    try:
        suffix = os.path.splitext(filename)[1] or ".ogg"
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, "wb") as f:
            f.write(audio_bytes)

        with open(tmp_path, "rb") as audio_file:
            transcript = await client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                prompt="Darija, Français, العربية. Merchant parle de stock, vente, produits.",
            )
        return transcript.text
    except Exception as e:
        import logging
        logging.getLogger("souk_ai").error(f"Whisper transcription failed: {e}")
        return ""
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
