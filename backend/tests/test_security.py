"""Security regressions found in docs/audit/AUDIT.md (S2-S8, S13)."""
import os

import redis.asyncio as aioredis

from tests.conftest import register


async def test_health(client):
    assert (await client.get("/health")).status_code == 200


async def test_admin_email_cannot_be_claimed_at_register(client, monkeypatch):
    """S2: registering with the admin email must not grant admin."""
    from app.config import settings
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "boss@souk.ai")
    h = await register(client, phone="0611111111", email="boss@souk.ai")
    assert (await client.get("/api/v1/admin/stats", headers=h)).status_code == 403


async def test_admin_email_cannot_be_claimed_via_profile(client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "ADMIN_EMAIL", "boss@souk.ai")
    h = await register(client, phone="0611111112")
    await client.patch("/api/v1/merchants/me", json={"email": "boss@souk.ai"}, headers=h)
    assert (await client.get("/api/v1/admin/stats", headers=h)).status_code == 403


async def test_admin_flag_grants_admin(client):
    from sqlalchemy import update

    from core.database import AsyncSessionLocal
    from models.merchant import Merchant
    h = await register(client, phone="0611111113")
    async with AsyncSessionLocal() as s:
        await s.execute(update(Merchant).values(is_admin=True))
        await s.commit()
    assert (await client.get("/api/v1/admin/stats", headers=h)).status_code == 200


async def test_otp_locks_after_5_wrong_attempts(client, monkeypatch):
    """S3: OTP brute force must be impossible."""
    import services.whatsapp as wa

    async def fake_send(phone, code):
        fake_send.code = code
    monkeypatch.setattr(wa, "send_otp_message", fake_send)
    await register(client, phone="0622222222")
    assert (await client.post("/api/v1/auth/reset-request", json={"phone_number": "0622222222"})).status_code == 200
    good = fake_send.code
    wrong = "000000" if good != "000000" else "111111"
    for _ in range(5):
        r = await client.post("/api/v1/auth/reset-confirm",
                              json={"phone_number": "0622222222", "code": wrong, "new_password": "N3w-password"})
        assert r.status_code == 400
    r = await client.post("/api/v1/auth/reset-confirm",
                          json={"phone_number": "0622222222", "code": good, "new_password": "N3w-password"})
    assert r.status_code == 400, "OTP must be burned after 5 failures"


async def test_password_reset_revokes_old_tokens(client, monkeypatch):
    import services.whatsapp as wa

    async def fake_send(phone, code):
        fake_send.code = code
    monkeypatch.setattr(wa, "send_otp_message", fake_send)
    old = await register(client, phone="0622222223")
    await client.post("/api/v1/auth/reset-request", json={"phone_number": "0622222223"})
    r = await client.post("/api/v1/auth/reset-confirm",
                          json={"phone_number": "0622222223", "code": fake_send.code, "new_password": "N3w-password"})
    assert r.status_code == 200
    assert (await client.get("/api/v1/auth/me", headers=old)).status_code == 401


async def test_reset_request_does_not_enumerate_accounts(client):
    """S13."""
    r = await client.post("/api/v1/auth/reset-request", json={"phone_number": "0699999999"})
    assert r.status_code == 200


async def test_login_is_rate_limited(client):
    await register(client, phone="0633333333")
    codes = [
        (await client.post("/api/v1/auth/login", json={"phone_number": "0633333333", "password": "bad"})).status_code
        for _ in range(12)
    ]
    assert 429 in codes


async def test_register_rejects_weak_password(client):
    r = await client.post("/api/v1/auth/register",
                          json={"phone_number": "0644444444", "password": "123", "business_name": "X"})
    assert r.status_code == 422


async def test_card_lookup_requires_auth(client):
    """S5: card numbers/balances must not be public."""
    for path in ("/api/v1/souk-cards/phone/212600000000", "/api/v1/souk-cards/9212000000000000",
                 "/api/v1/souk-cards/nfc/abcd"):
        assert (await client.get(path)).status_code in (401, 403)


async def _card(client, h, pin="4321", amount=100):
    r = await client.post("/api/v1/souk-cards/register",
                          json={"holder_name": "Ali", "holder_phone": "212600000001", "pin": pin}, headers=h)
    assert r.status_code == 200, r.text
    num = r.json()["card_number"]
    r = await client.post("/api/v1/souk-cards/topup", json={"card_number": num, "amount": amount}, headers=h)
    assert r.status_code == 200, r.text
    return num


async def _invoice(client, h, price=20):
    r = await client.post("/api/v1/invoices/",
                          json={"items": [{"product_name": "Pain", "quantity": 1, "unit_price": price}]}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()["token"]


async def test_typed_card_number_always_needs_pin(client):
    """S5: <50 MAD without PIN is only for a physical NFC tap, not a typed number."""
    h = await register(client, phone="0655555555")
    num = await _card(client, h)
    token = await _invoice(client, h, price=20)
    r = await client.post(f"/api/v1/invoices/pay/{token}", json={"method": "NFC_SOUKCARD", "card_number": num})
    assert r.status_code == 400


async def test_card_pin_locks_after_5_failures(client):
    """S6."""
    h = await register(client, phone="0655555556")
    num = await _card(client, h, pin="4321")
    for _ in range(5):
        token = await _invoice(client, h)
        await client.post(f"/api/v1/invoices/pay/{token}",
                          json={"method": "NFC_SOUKCARD", "card_number": num, "pin": "0000"})
    token = await _invoice(client, h)
    r = await client.post(f"/api/v1/invoices/pay/{token}",
                          json={"method": "NFC_SOUKCARD", "card_number": num, "pin": "4321"})
    assert r.status_code == 400 and "bloqu" in r.json()["detail"].lower()


async def test_public_cannot_mark_invoice_paid_cash(client):
    """S7: a customer opening the pay link must not be able to self-declare CASH/NFC_BANK."""
    h = await register(client, phone="0666666666")
    token = await _invoice(client, h)
    for method in ("CASH", "NFC_BANK"):
        r = await client.post(f"/api/v1/invoices/pay/{token}", json={"method": method})
        assert r.status_code in (401, 403), method
    r = await client.post(f"/api/v1/invoices/pay/{token}", json={"method": "CASH"}, headers=h)
    assert r.status_code == 200


async def test_other_merchant_cannot_cash_my_invoice(client):
    h1 = await register(client, phone="0666666667")
    h2 = await register(client, phone="0666666668")
    token = await _invoice(client, h1)
    r = await client.post(f"/api/v1/invoices/pay/{token}", json={"method": "CASH"}, headers=h2)
    assert r.status_code == 403


async def test_topup_daily_cap_per_merchant(client):
    """S4: unlimited free top-ups = money printing."""
    h = await register(client, phone="0677777777")
    r = await client.post("/api/v1/souk-cards/register",
                          json={"holder_name": "Amine", "holder_phone": "212600000009", "pin": "1234"}, headers=h)
    num = r.json()["card_number"]
    codes = [(await client.post("/api/v1/souk-cards/topup", json={"card_number": num, "amount": 5000},
                                headers=h)).status_code for _ in range(5)]
    assert codes[0] == 200 and 400 in codes


async def test_whatsapp_webhook_fails_closed_in_production(client, monkeypatch):
    """S8."""
    from app.config import settings
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "WHATSAPP_APP_SECRET", "")
    r = await client.post("/api/v1/whatsapp/webhook", json={"entry": []})
    assert r.status_code == 403


async def test_whatsapp_webhook_valid_signature(client, monkeypatch):
    import hashlib
    import hmac
    from app.config import settings
    monkeypatch.setattr(settings, "WHATSAPP_APP_SECRET", "s3cret")
    body = b'{"entry": []}'
    sig = "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
    r = await client.post("/api/v1/whatsapp/webhook", content=body,
                          headers={"x-hub-signature-256": sig, "content-type": "application/json"})
    assert r.status_code == 200
    r = await client.post("/api/v1/whatsapp/webhook", content=body,
                          headers={"x-hub-signature-256": "sha256=bad", "content-type": "application/json"})
    assert r.status_code == 403


async def test_cmi_callback_fails_closed_in_production(client, monkeypatch):
    from app.config import settings
    from services.payment_service import _verify_cmi_hash
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "CMI_STORE_KEY", "")
    assert _verify_cmi_hash({"OrderId": "x"}) is False


def test_production_refuses_default_secret(monkeypatch):
    """S9."""
    import pytest

    from app.config import Settings
    with pytest.raises(ValueError):
        Settings(APP_ENV="production", SECRET_KEY="changeme")
    Settings(APP_ENV="production", SECRET_KEY="x" * 40)


async def test_redis_cleanup_helper():
    r = aioredis.from_url(os.environ["REDIS_URL"])
    assert await r.ping()
    await r.aclose()


async def test_readiness_and_request_id(client):
    r = await client.get("/health/ready", headers={"x-request-id": "abc123"})
    assert r.status_code == 200 and r.json()["checks"] == {"database": "ok", "redis": "ok"}
    assert r.headers["x-request-id"] == "abc123"


async def test_upload_size_and_type_limits(client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test")
    h = await register(client, phone="0688888888")
    r = await client.post("/api/v1/products/scan-invoice", headers=h,
                          files={"file": ("x.exe", b"MZ...", "application/octet-stream")})
    assert r.status_code == 415
    import core.uploads as up
    monkeypatch.setattr(up, "MAX_UPLOAD_BYTES", 10)
    r = await client.post("/api/v1/sage/import/articles", headers=h,
                          files={"file": ("a.csv", b"x" * 11, "text/csv")})
    assert r.status_code == 413


async def test_other_market_signup_and_login(client, monkeypatch):
    """A French shop registered with a national number can log in with the same number."""
    from app.config import settings
    monkeypatch.setattr(settings, "DEFAULT_COUNTRY", "FR")
    await register(client, phone="06 12 34 56 78")
    me = (await client.post("/api/v1/auth/login", json={"phone_number": "0612345678", "password": "Sup3r-secret"}))
    assert me.status_code == 200
    h = {"Authorization": f"Bearer {me.json()['access_token']}"}
    prof = (await client.get("/api/v1/auth/me", headers=h)).json()
    assert prof["phone_number"] == "33612345678" and prof["currency"] == "EUR"


async def test_no_mock_loan_offers_and_market_data_is_admin_only(client):
    """D13/D14: no fabricated loan offers; platform-wide market aggregates are not public to merchants."""
    h = await register(client, phone="0688000001")
    offers = (await client.get("/api/v1/credit/offers", headers=h)).json()
    assert offers["offers"] == [] and offers["eligibility"] is False
    assert (await client.post("/api/v1/credit/request", json={}, headers=h)).status_code == 410
    assert (await client.get("/api/v1/market/overview", headers=h)).status_code == 403


async def test_countries_list_is_public(client):
    r = await client.get("/api/v1/auth/countries")
    assert r.status_code == 200
    codes = {c["code"]: c for c in r.json()}
    assert codes["FR"]["currency"] == "EUR" and codes["US"]["calling_code"] == "1"
