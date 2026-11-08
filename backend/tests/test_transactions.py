"""Sale → stock → credit → card integrity (AUDIT L1-L5, S14)."""
import asyncio
import uuid

from tests.conftest import make_product, register

BULK = "/api/v1/transactions/bulk"


async def _stock(client, h, pid):
    r = await client.get(f"/api/v1/products/{pid}", headers=h)
    return r.json()["stock_quantity"]


async def _customer(client, h, limit=0, name="Fatima"):
    r = await client.post("/api/v1/customers/", json={"name": name, "credit_limit": limit}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def test_negative_quantity_rejected(client):
    h = await register(client)
    p = await make_product(client, h, stock=10)
    r = await client.post("/api/v1/transactions/", json={"product_id": p["id"], "quantity": -5, "unit_price": 5},
                          headers=h)
    assert r.status_code == 422
    assert await _stock(client, h, p["id"]) == 10


async def test_cash_sale_moves_stock_and_rounds_money(client):
    h = await register(client)
    p = await make_product(client, h, stock=10)
    r = await client.post(BULK, json={"items": [{"product_id": p["id"], "quantity": 3, "unit_price": 0.1}]},
                          headers=h)
    assert r.status_code == 201, r.text
    assert r.json()[0]["total_amount"] == 0.3
    assert await _stock(client, h, p["id"]) == 7


async def test_cart_with_same_product_twice_cannot_oversell(client):
    h = await register(client)
    p = await make_product(client, h, stock=5)
    items = [{"product_id": p["id"], "quantity": 3, "unit_price": 5}] * 2
    assert (await client.post(BULK, json={"items": items}, headers=h)).status_code == 400
    assert await _stock(client, h, p["id"]) == 5


async def test_concurrent_tills_cannot_sell_last_unit_twice(client):
    h = await register(client)
    p = await make_product(client, h, stock=1)
    body = {"items": [{"product_id": p["id"], "quantity": 1, "unit_price": 5}]}
    codes = sorted(r.status_code for r in await asyncio.gather(*[client.post(BULK, json=body, headers=h)
                                                                  for _ in range(4)]))
    assert codes.count(201) == 1, codes
    assert await _stock(client, h, p["id"]) == 0


async def test_idempotency_key_prevents_double_sale(client):
    h = await register(client)
    p = await make_product(client, h, stock=10)
    body = {"items": [{"product_id": p["id"], "quantity": 2, "unit_price": 5}]}
    hk = {**h, "Idempotency-Key": str(uuid.uuid4())}
    r1 = await client.post(BULK, json=body, headers=hk)
    r2 = await client.post(BULK, json=body, headers=hk)
    assert r1.status_code == 201 and r2.status_code in (200, 201)
    assert r1.json() == r2.json()
    assert await _stock(client, h, p["id"]) == 8


async def test_credit_sale_is_atomic_with_credit_limit(client):
    """L3: if the credit entry is refused, the goods must not leave the shop."""
    h = await register(client)
    p = await make_product(client, h, stock=10, price=50)
    cid = await _customer(client, h, limit=60)
    body = {"items": [{"product_id": p["id"], "quantity": 2, "unit_price": 50}], "customer_id": cid,
            "payment_method": "CREDIT"}
    r = await client.post(BULK, json=body, headers=h)
    assert r.status_code == 400 and "Plafond" in r.json()["detail"]
    assert await _stock(client, h, p["id"]) == 10
    body["items"][0]["quantity"] = 1
    assert (await client.post(BULK, json=body, headers=h)).status_code == 201
    c = (await client.get(f"/api/v1/customers/{cid}", headers=h)).json()
    assert c["balance"] == 50 and len(c["entries"]) == 1


async def test_credit_sale_requires_customer(client):
    h = await register(client)
    p = await make_product(client, h)
    r = await client.post(BULK, json={"items": [{"product_id": p["id"], "quantity": 1, "unit_price": 5}],
                                      "payment_method": "CREDIT"}, headers=h)
    assert r.status_code == 400


async def test_card_checkout_is_atomic(client):
    """L2: a declined card leaves stock untouched; an accepted one debits exactly the total."""
    h = await register(client)
    p = await make_product(client, h, stock=10, price=30)
    r = await client.post("/api/v1/souk-cards/register",
                          json={"holder_name": "Ali", "holder_phone": "212600000001", "pin": "4321"}, headers=h)
    num = r.json()["card_number"]
    await client.post("/api/v1/souk-cards/topup", json={"card_number": num, "amount": 100}, headers=h)
    body = {"items": [{"product_id": p["id"], "quantity": 4, "unit_price": 30}],
            "payment_method": "NFC_SOUKCARD", "card_number": num, "pin": "4321"}
    r = await client.post(BULK, json=body, headers=h)
    assert r.status_code == 400 and "Solde insuffisant" in r.json()["detail"]
    assert await _stock(client, h, p["id"]) == 10
    body["items"][0]["quantity"] = 3
    assert (await client.post(BULK, json=body, headers=h)).status_code == 201
    card = (await client.get(f"/api/v1/souk-cards/{num}", headers=h)).json()
    assert card["balance"] == 10
    assert await _stock(client, h, p["id"]) == 7


async def test_cannot_attach_sale_to_other_merchants_customer(client):
    h1 = await register(client, phone="0611000001")
    h2 = await register(client, phone="0611000002")
    foreign = await _customer(client, h1)
    p = await make_product(client, h2)
    r = await client.post(BULK, json={"items": [{"product_id": p["id"], "quantity": 1, "unit_price": 5}],
                                      "customer_id": foreign}, headers=h2)
    assert r.status_code == 404


async def test_return_restocks_once(client):
    h = await register(client)
    p = await make_product(client, h, stock=10)
    sale = (await client.post(BULK, json={"items": [{"product_id": p["id"], "quantity": 2, "unit_price": 5}]},
                              headers=h)).json()[0]
    assert (await client.post(f"/api/v1/transactions/{sale['id']}/return", headers=h)).status_code == 201
    assert (await client.post(f"/api/v1/transactions/{sale['id']}/return", headers=h)).status_code == 409
    assert await _stock(client, h, p["id"]) == 10


async def test_credit_payment_cannot_exceed_balance(client):
    h = await register(client)
    cid = await _customer(client, h)
    assert (await client.post(f"/api/v1/customers/{cid}/entries", json={"type": "CREDIT", "amount": 20},
                              headers=h)).status_code == 201
    r = await client.post(f"/api/v1/customers/{cid}/entries", json={"type": "PAYMENT", "amount": 25}, headers=h)
    assert r.status_code == 400
    r = await client.post(f"/api/v1/customers/{cid}/entries", json={"type": "PAYMENT", "amount": 20}, headers=h)
    assert r.status_code == 201


async def test_customers_list_works_on_migrated_schema(client):
    """Drift: customers.is_active was INTEGER on fresh installs → `is_active == True` crashed."""
    h = await register(client)
    await _customer(client, h)
    r = await client.get("/api/v1/customers/", headers=h)
    assert r.status_code == 200 and len(r.json()) == 1


async def test_credit_score_is_net_of_returns(client):
    """L7: selling then returning the same goods must not raise the score."""
    from core.database import AsyncSessionLocal
    from services.credit_scoring import calculate_credit_score
    h = await register(client)
    p = await make_product(client, h, stock=1000, price=1000)
    me = (await client.get("/api/v1/auth/me", headers=h)).json()
    for _ in range(3):
        sale = (await client.post(BULK, json={"items": [{"product_id": p["id"], "quantity": 5, "unit_price": 1000}]},
                                  headers=h)).json()[0]
        await client.post(f"/api/v1/transactions/{sale['id']}/return", headers=h)
    async with AsyncSessionLocal() as db:
        score = await calculate_credit_score(db, me["id"])
    assert score["factors"]["volume_points"] == 0


async def test_whatsapp_sale_respects_stock_and_journal(client):
    """Bot sales go through the same checked, journaled path as the POS (logic pass 2)."""
    import pytest

    from core.database import AsyncSessionLocal
    from services.inventory import record_sale
    from services.sales import SaleError
    h = await register(client)
    me = (await client.get("/api/v1/auth/me", headers=h)).json()
    p = await make_product(client, h, stock=2, price=5)
    async with AsyncSessionLocal() as db:
        with pytest.raises(SaleError):
            await record_sale(db, me["id"], p["id"], 3, 5.0)
        await db.rollback()
        await record_sale(db, me["id"], p["id"], 2, 5.0)
        await db.commit()
    assert await _stock(client, h, p["id"]) == 0
    logs = (await client.get("/api/v1/inventory/logs", headers=h)).json()
    assert [(lg["source"], lg["quantity_change"]) for lg in logs] == [("sale", -2.0)]

