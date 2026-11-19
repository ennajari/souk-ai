"""Supplier orders (logic pass 2): ownership, validation, delivery → stock, weighted cost."""
from tests.conftest import make_product, register

S = "/api/v1/suppliers"


async def _supplier(client, h, phone="0699000001"):
    r = await client.post(f"{S}/", json={"name": "Centrale Laitière", "phone_number": phone}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _stock_and_cost(client, h, pid):
    p = (await client.get(f"/api/v1/products/{pid}", headers=h)).json()
    return p["stock_quantity"], p["cost_price"]


async def test_receive_puts_goods_in_stock_once_at_weighted_cost(client):
    h = await register(client)
    p = await make_product(client, h, stock=10, price=10, cost_price=6)
    sid = await _supplier(client, h)
    order = (await client.post(f"{S}/{sid}/order", json={"items": [
        {"product_id": p["id"], "quantity": 50}]}, headers=h)).json()
    # catalog lines are priced at the product's cost; simulate a new supplier price of 7
    from sqlalchemy import update

    from core.database import AsyncSessionLocal
    from models.supplier_order import SupplierOrder
    async with AsyncSessionLocal() as db:
        await db.execute(update(SupplierOrder).where(SupplierOrder.id == order["id"]).values(
            items=[{"product_id": p["id"], "product_name": "Sucre", "quantity": 50, "unit_price": 7}]))
        await db.commit()

    r = await client.post(f"{S}/{sid}/orders/{order['id']}/receive", headers=h)
    assert r.status_code == 200 and r.json()["lines_received"] == 1
    stock, cost = await _stock_and_cost(client, h, p["id"])
    assert stock == 60 and cost == round((10 * 6 + 50 * 7) / 60, 2)
    assert (await client.post(f"{S}/{sid}/orders/{order['id']}/receive", headers=h)).status_code == 409
    assert (await _stock_and_cost(client, h, p["id"]))[0] == 60
    logs = (await client.get("/api/v1/inventory/logs", headers=h)).json()
    assert logs[0]["source"] == "purchase" and logs[0]["quantity_change"] == 50


async def test_cannot_order_from_another_merchants_supplier(client):
    h1 = await register(client, phone="0611000021")
    h2 = await register(client, phone="0611000022")
    sid = await _supplier(client, h1)
    r = await client.post(f"{S}/{sid}/order", json={"items": [{"product_name": "X", "unit_price": 1, "quantity": 1}]},
                          headers=h2)
    assert r.status_code == 404


async def test_negative_quantity_rejected(client):
    h = await register(client)
    sid = await _supplier(client, h)
    r = await client.post(f"{S}/{sid}/order", json={"items": [{"product_name": "X", "unit_price": 5, "quantity": -3}]},
                          headers=h)
    assert r.status_code == 422


async def test_supplier_portal_delivery_restocks_merchant(client):
    h = await register(client, phone="0611000031")
    p = await make_product(client, h, stock=0, price=10, cost_price=6)
    sid = await _supplier(client, h, phone="0699000099")
    order = (await client.post(f"{S}/{sid}/order", json={"items": [{"product_id": p["id"], "quantity": 12}]},
                               headers=h)).json()
    sup = await register(client, phone="0699000099", account_type="SUPPLIER")  # auto-linked by phone
    for st in ("SUBMITTED", "IN_DELIVERY", "DELIVERED"):
        r = await client.patch(f"/api/v1/supplier-portal/orders/{order['id']}/status", json={"status": st}, headers=sup)
        assert r.status_code == 200, (st, r.text)
    assert (await _stock_and_cost(client, h, p["id"]))[0] == 12


async def test_wholesaler_serving_two_shops_reaches_both_whatever_signs_up_first(client):
    """Real flow: shop A adds the wholesaler, the wholesaler signs up, then shop B adds them.
    Both shops are connected, the wholesaler sees both orders, and one catalogue serves both shops."""
    a = await register(client, phone="0611000041")
    sid_a = await _supplier(client, a, phone="0699000041")
    sup = await register(client, phone="+212 699-000041", account_type="SUPPLIER")  # other format, same number
    b = await register(client, phone="0611000042")
    sid_b = await _supplier(client, b, phone="06 99 00 00 41")  # added after the wholesaler signed up

    shops = {s["id"]: s for s in (await client.get(f"{S}/", headers=a)).json() + (await client.get(f"{S}/", headers=b)).json()}
    assert shops[sid_a]["is_connected"] and shops[sid_b]["is_connected"]

    for h, sid in ((a, sid_a), (b, sid_b)):
        r = await client.post(f"{S}/{sid}/order", json={"items": [{"product_name": "Lait", "unit_price": 7, "quantity": 10}]}, headers=h)
        assert r.status_code == 201, r.text
    orders = (await client.get("/api/v1/supplier-portal/orders", headers=sup)).json()
    assert len(orders) == 2 and {o["merchant_phone"] for o in orders} == {"212611000041", "212611000042"}
    assert (await client.get("/api/v1/supplier-portal/dashboard", headers=sup)).json()["shops"] == 2

    r = await client.post("/api/v1/supplier-portal/catalog", json={"name": "Lait 1L", "unit_price": 6.5}, headers=sup)
    assert r.status_code == 201, r.text
    for h, sid in ((a, sid_a), (b, sid_b)):
        assert [i["name"] for i in (await client.get(f"/api/v1/supplier-catalog/{sid}", headers=h)).json()] == ["Lait 1L"]
    # a shop cannot read the catalogue through another shop's supplier record
    assert (await client.get(f"/api/v1/supplier-catalog/{sid_a}", headers=b)).status_code == 404
    # a free or nameless catalogue item is refused
    assert (await client.post("/api/v1/supplier-portal/catalog", json={"name": "X", "unit_price": 0}, headers=sup)).status_code == 422


async def test_changing_the_phone_moves_the_link(client):
    h = await register(client, phone="0611000051")
    await register(client, phone="0699000051", account_type="SUPPLIER")
    sid = await _supplier(client, h, phone="0699000051")
    r = await client.patch(f"{S}/{sid}", json={"phone_number": "0699000052"}, headers=h)
    assert r.status_code == 200 and r.json()["is_connected"] is False
