"""Money report (AUDIT U3)."""
from datetime import date, timedelta

from tests.conftest import make_product, register


async def test_money_report(client):
    h = await register(client)
    today = date.today()
    expired = await make_product(client, h, stock=4, price=10, name_fr="Yaourt", name_ar="ياغورت",
                                 cost_price=6, expiry_date=(today - timedelta(days=1)).isoformat())
    soon = await make_product(client, h, stock=2, price=10, name_fr="Lait", name_ar="حليب",
                              cost_price=5, expiry_date=(today + timedelta(days=3)).isoformat())
    hot = await make_product(client, h, stock=3, price=10, name_fr="Pain", name_ar="خبز", cost_price=4)
    # sell out "Pain" → stock-out with recent demand
    r = await client.post("/api/v1/transactions/bulk",
                          json={"items": [{"product_id": hot["id"], "quantity": 3, "unit_price": 10}]}, headers=h)
    assert r.status_code == 201
    c = (await client.post("/api/v1/customers/", json={"name": "Said"}, headers=h)).json()
    await client.post(f"/api/v1/customers/{c['id']}/entries", json={"type": "CREDIT", "amount": 120}, headers=h)

    rep = (await client.get("/api/v1/analytics/money-report", headers=h)).json()
    assert rep["currency"] == "MAD"
    assert rep["to_recover"]["total"] == 120 and rep["to_recover"]["customers"] == 1
    assert rep["lost"]["total"] == 24 and rep["lost"]["expired"][0]["product_id"] == expired["id"]
    assert rep["at_risk"]["expiring_soon"][0]["product_id"] == soon["id"]
    out = rep["missed_sales_per_week"]["out_of_stock"]
    assert out and out[0]["product_id"] == hot["id"] and out[0]["value"] == 4.2  # 3/30*7 units x 6 margin
