"""Inventory logic (logic pass 2)."""
from tests.conftest import make_product, register


async def test_adjust_cannot_go_negative_and_is_logged(client):
    h = await register(client)
    p = await make_product(client, h, stock=5)
    r = await client.post("/api/v1/inventory/adjust", json={"product_id": p["id"], "quantity_change": -6}, headers=h)
    assert r.status_code == 400
    r = await client.post("/api/v1/inventory/adjust",
                          json={"product_id": p["id"], "quantity_change": -2, "reason": "Casse"}, headers=h)
    assert r.status_code == 200 and r.json()["quantity"] == 3
    logs = (await client.get("/api/v1/inventory/logs", headers=h)).json()
    assert logs[0]["reason"] == "Casse" and logs[0]["quantity_after"] == 3
    r = await client.post("/api/v1/inventory/adjust", json={"product_id": p["id"], "quantity_change": 0}, headers=h)
    assert r.status_code == 422


async def test_threshold_update_works(client):
    """Used to crash (lazy relationship loaded in async code)."""
    h = await register(client)
    p = await make_product(client, h, stock=5)
    r = await client.patch(f"/api/v1/inventory/{p['id']}/threshold", json={"reorder_threshold": 8}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["reorder_threshold"] == 8
    assert len((await client.get("/api/v1/inventory/alerts", headers=h)).json()) == 1
    r = await client.patch(f"/api/v1/inventory/{p['id']}/threshold", json={"reorder_threshold": -1}, headers=h)
    assert r.status_code == 422


async def test_cannot_adjust_other_merchants_stock(client):
    h1 = await register(client, phone="0611000011")
    h2 = await register(client, phone="0611000012")
    p = await make_product(client, h1, stock=5)
    r = await client.post("/api/v1/inventory/adjust", json={"product_id": p["id"], "quantity_change": 10}, headers=h2)
    assert r.status_code == 404


async def test_merge_into_itself_is_refused(client):
    h = await register(client)
    p = await make_product(client, h, stock=5)
    r = await client.post(f"/api/v1/products/{p['id']}/merge/{p['id']}", headers=h)
    assert r.status_code == 400
    prod = (await client.get(f"/api/v1/products/{p['id']}", headers=h)).json()
    assert prod["stock_quantity"] == 5 and prod["is_active"]


async def test_merge_sums_stock_at_weighted_cost(client):
    h = await register(client)
    a = await make_product(client, h, stock=10, cost_price=6, name_fr="Sucre 1kg", name_ar="سكر")
    b = await make_product(client, h, stock=30, cost_price=8, name_fr="Sucre", name_ar="سكر كيلو")
    r = await client.post(f"/api/v1/products/{a['id']}/merge/{b['id']}", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["stock_quantity"] == 40 and r.json()["cost_price"] == 7.5
