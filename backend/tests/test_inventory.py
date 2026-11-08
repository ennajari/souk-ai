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
