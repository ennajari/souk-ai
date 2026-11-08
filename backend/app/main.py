import json
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from api.v1.router import api_router
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(message)s")
access_log = logging.getLogger("souk_ai.access")

app = FastAPI(
    title="Souk.AI API",
    description="AI-Powered Inventory & Sales Management for Moroccan Merchants",
    version="2.0.0",
    # Public API docs only outside production (AUDIT S20)
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["content-type", "authorization", "idempotency-key", "x-request-id"],
    expose_headers=["x-request-id"],
    max_age=3600,
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """One JSON access line per request with a request id (returned as X-Request-ID) (AUDIT A4)."""
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex
    start = time.perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        response.headers["x-request-id"] = rid
        return response
    finally:
        access_log.info(json.dumps({
            "rid": rid, "method": request.method, "path": request.url.path, "status": status,
            "ms": round((time.perf_counter() - start) * 1000, 1),
        }))


app.include_router(api_router)


@app.get("/health")
async def health():
    """Liveness: the process answers."""
    return {"status": "ok", "version": "2.0.0"}


@app.get("/health/ready")
async def ready():
    """Readiness: dependencies needed to take a sale are reachable (use for load balancer / compose)."""
    from core.database import engine
    from core.ratelimit import get_redis

    checks = {}
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:  # noqa: BLE001
        checks["database"] = f"error: {type(e).__name__}"
    try:
        await get_redis().ping()
        checks["redis"] = "ok"
    except Exception as e:  # noqa: BLE001
        checks["redis"] = f"error: {type(e).__name__}"
    ok = all(v == "ok" for v in checks.values())
    return JSONResponse({"status": "ok" if ok else "degraded", "checks": checks}, status_code=200 if ok else 503)
