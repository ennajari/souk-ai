from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from api.v1.router import api_router

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
    allow_headers=["content-type", "authorization"],
    max_age=3600,
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
