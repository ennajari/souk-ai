"""Integration test harness: real Postgres (migrated with Alembic) + real Redis.

Env: TEST_DATABASE_URL / TEST_REDIS_URL (defaults match `make test-up`).
"""
import os
import subprocess
import sys
from pathlib import Path

os.environ["DATABASE_URL"] = os.getenv(
    "TEST_DATABASE_URL", "postgresql+asyncpg://souk:souk@localhost:55432/souk_test"
)
os.environ["REDIS_URL"] = os.getenv("TEST_REDIS_URL", "redis://localhost:56379/15")
os.environ.setdefault("SECRET_KEY", "test-secret-key-0123456789abcdef0123456789abcdef")
os.environ["APP_ENV"] = "test"
os.environ["ADMIN_PHONE"] = ""
os.environ["WHATSAPP_ACCESS_TOKEN"] = ""
os.environ["OPENAI_API_KEY"] = ""

import httpx  # noqa: E402
import pytest  # noqa: E402
import redis.asyncio as aioredis  # noqa: E402
from sqlalchemy import text  # noqa: E402

BACKEND = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session", autouse=True)
def migrated_db():
    """Fresh schema built by the real migration chain (catches model/migration drift)."""
    import asyncio

    from sqlalchemy.ext.asyncio import create_async_engine

    async def reset():
        eng = create_async_engine(os.environ["DATABASE_URL"])
        async with eng.begin() as c:
            await c.execute(text("DROP SCHEMA public CASCADE"))
            await c.execute(text("CREATE SCHEMA public"))
        await eng.dispose()

    asyncio.run(reset())
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND, check=True)


@pytest.fixture(autouse=True)
async def clean_state():
    from core.database import engine

    async with engine.begin() as c:
        rows = await c.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version'"
        ))
        tables = ", ".join(f'"{r[0]}"' for r in rows)
        if tables:
            await c.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    r = aioredis.from_url(os.environ["REDIS_URL"])
    await r.flushdb()
    await r.aclose()
    yield


@pytest.fixture
async def client():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def register(client, phone="0612345678", password="Sup3r-secret", **extra):
    body = {"phone_number": phone, "password": password, "business_name": "Hanout Test", **extra}
    res = await client.post("/api/v1/auth/register", json=body)
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def make_product(client, headers, stock=10, price=5, **extra):
    body = {"name_ar": "سكر", "name_fr": "Sucre", "unit_price": price, "cost_price": 3,
            "initial_stock": stock, **extra}
    res = await client.post("/api/v1/products/", json=body, headers=headers)
    assert res.status_code in (200, 201), res.text
    return res.json()
