"""Analytics correctness (logic pass 2): local day, returns, frozen cost, no double counting."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import update

from core.database import AsyncSessionLocal
from models.merchant import Merchant
from models.transaction import Transaction
from tests.conftest import make_product, register

BULK = "/api/v1/transactions/bulk"


async def _sell(client, h, pid, qty, price):
    r = await client.post(BULK, json={"items": [{"product_id": pid, "quantity": qty, "unit_price": price}]}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()[0]["id"]


async def test_returns_are_deducted_from_revenue_and_profit(client):
    h = await register(client)
    p = await make_product(client, h, stock=50, price=10, cost_price=6)
    await _sell(client, h, p["id"], 5, 10)
    sale = await _sell(client, h, p["id"], 2, 10)
    await client.post(f"/api/v1/transactions/{sale}/return", headers=h)

    dash = (await client.get("/api/v1/analytics/dashboard", headers=h)).json()
    assert dash["total_revenue_today"] == 50 and dash["total_sales_today"] == 2
    prof = (await client.get("/api/v1/analytics/profit", headers=h)).json()
    assert prof["total_revenue"] == 50 and prof["total_cost"] == 30 and prof["total_profit"] == 20
    assert prof["products"][0]["quantity_sold"] == 5


async def test_cost_change_does_not_rewrite_past_margins(client):
    h = await register(client)
    p = await make_product(client, h, stock=10, price=10, cost_price=6)
    await _sell(client, h, p["id"], 1, 10)
    await client.patch(f"/api/v1/products/{p['id']}", json={"cost_price": 9}, headers=h)
    await _sell(client, h, p["id"], 1, 10)
    prof = (await client.get("/api/v1/analytics/profit", headers=h)).json()
    assert prof["total_cost"] == 15  # 6 for the first sale, 9 for the second


async def test_today_is_the_merchants_local_day(client):
    """A sale at 23:00 yesterday in New York is 04:00 UTC today: it must not count as today."""
    h = await register(client)
    me = (await client.get("/api/v1/auth/me", headers=h)).json()
    p = await make_product(client, h, stock=10, price=10)
    sid = await _sell(client, h, p["id"], 1, 10)
    ny = ZoneInfo("America/New_York")
    local_yesterday_23h = datetime.now(ny).replace(hour=23, minute=0, second=0, microsecond=0) - timedelta(days=1)
    async with AsyncSessionLocal() as s:
        await s.execute(update(Merchant).where(Merchant.id == me["id"]).values(timezone="America/New_York"))
        await s.execute(update(Transaction).where(Transaction.id == sid)
                        .values(created_at=local_yesterday_23h.astimezone(timezone.utc)))
        await s.commit()
    dash = (await client.get("/api/v1/analytics/dashboard", headers=h)).json()
    assert dash["total_revenue_today"] == 0
    chart = (await client.get("/api/v1/analytics/sales-chart?days=2", headers=h)).json()
    assert [pt["revenue"] for pt in chart] == [10, 0]
    assert chart[0]["date"] == local_yesterday_23h.date().isoformat()


async def test_monthly_profit_does_not_count_stock_purchases_twice(client):
    h = await register(client)
    p = await make_product(client, h, stock=100, price=10, cost_price=6)
    await _sell(client, h, p["id"], 10, 10)  # revenue 100, COGS 60
    sup = (await client.post("/api/v1/suppliers/", json={"name": "Centrale", "phone_number": "0611112222"},
                             headers=h)).json()
    order = (await client.post(f"/api/v1/suppliers/{sup['id']}/order",
                               json={"items": [{"product_id": p["id"], "quantity": 50}]}, headers=h)).json()
    from models.supplier_order import SupplierOrder, SupplierOrderStatus
    async with AsyncSessionLocal() as s:
        await s.execute(update(SupplierOrder).where(SupplierOrder.id == order["id"])
                        .values(status=SupplierOrderStatus.SUBMITTED))
        await s.commit()
    r = await client.post(f"/api/v1/suppliers/{sup['id']}/orders/{order['id']}/pay", json={"method": "CASH"},
                          headers=h)
    assert r.status_code == 200, r.text
    m = (await client.get("/api/v1/analytics/monthly-revenue", headers=h)).json()
    assert m["total_sales"] == 100 and m["total_cogs"] == 60 and m["total_supplier_costs"] == 300
    assert m["net_revenue"] == 40  # was 100 - 60 - 300 = -260 before the fix
