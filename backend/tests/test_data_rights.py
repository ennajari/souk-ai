"""GDPR / loi 09-08: access (export) and erasure (AUDIT K2)."""
from tests.conftest import make_product, register


async def _seed(client, h):
    p = await make_product(client, h, stock=10)
    await client.post("/api/v1/transactions/bulk",
                      json={"items": [{"product_id": p["id"], "quantity": 1, "unit_price": 5}]}, headers=h)
    c = (await client.post("/api/v1/customers/", json={"name": "Karim", "phone": "0612121212"}, headers=h)).json()
    await client.post(f"/api/v1/customers/{c['id']}/entries", json={"type": "CREDIT", "amount": 10}, headers=h)
    await client.post("/api/v1/invoices/", json={"items": [{"product_name": "Pain", "quantity": 1, "unit_price": 2}]},
                      headers=h)
    r = await client.post("/api/v1/souk-cards/register",
                          json={"holder_name": "Karim", "holder_phone": "212612121212", "pin": "1234"}, headers=h)
    num = r.json()["card_number"]
    await client.post("/api/v1/souk-cards/topup", json={"card_number": num, "amount": 50}, headers=h)
    return p


async def test_export_contains_data_without_secrets(client):
    h = await register(client)
    await _seed(client, h)
    r = await client.get("/api/v1/merchants/me/export", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert len(data["products"]) == 1 and len(data["transactions"]) == 1
    assert len(data["customers"]) == 1 and len(data["credit_entries"]) == 1 and len(data["inventory"]) == 1
    assert "hashed_password" not in data["merchant"] and "token_version" not in data["merchant"]


async def test_account_deletion_works_with_data(client):
    h = await register(client)
    await _seed(client, h)
    r = await client.delete("/api/v1/auth/account", headers=h)
    assert r.status_code == 204, r.text
    assert (await client.get("/api/v1/auth/me", headers=h)).status_code == 401
