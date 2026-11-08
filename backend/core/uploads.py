from fastapi import HTTPException, UploadFile

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # matches nginx client_max_body_size
IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}


async def read_limited(file: UploadFile, max_bytes: int | None = None) -> bytes:
    """Read an upload without ever buffering more than max_bytes (AUDIT S15)."""
    max_bytes = max_bytes or MAX_UPLOAD_BYTES
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"Fichier trop volumineux (max {max_bytes / (1024 * 1024):g} Mo)")
    if not data:
        raise HTTPException(400, "Fichier vide")
    return data
