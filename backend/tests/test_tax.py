"""VAT per product (tax-inclusive prices), frozen per sale line, monthly summary."""
from tests.conftest import make_product, register

BULK = "/api/v1/transactions/bulk"


async def test_tax_summary_per_rate_net_of_returns(client):
    h = await register(client)
    soda = await make_product(client, h, stock=50, price=12, tax_rate=20, name_fr="Soda", name_ar="مشروب")
    bread = await make_product(client, h, stock=50, price=1.5, name_fr="Pain", name_ar="خبز")  # no rate set
    sale = (await client.post(BULK, json={"items": [
        {"product_id": soda["id"], "quantity": 10, "unit_price": 12},
        {"product_id": bread["id"], "quantity": 4, "unit_price": 1.5}]}, headers=h)).json()
    await client.post(f"/api/v1/transactions/{sale[0]['id']}/return", headers=h)  # whole soda line returned
    await client.post(BULK, json={"items": [{"product_id": soda["id"], "quantity": 5, "unit_price": 12}]}, headers=h)

    # rate changes later: past lines keep the 20 % they were sold with
    await client.patch(f"/api/v1/products/{soda['id']}", json={"tax_rate": 10}, headers=h)
    r = (await client.get("/api/v1/analytics/tax-summary", headers=h)).json()
    assert r["lines"] == [{"rate": 20.0, "gross": 60.0, "tax": 10.0, "net": 50.0}]
    assert r["gross_without_rate"] == 6.0 and r["total_tax"] == 10.0


async def test_country_rates_and_validation(client):
    h = await register(client)
    rates = (await client.get("/api/v1/merchants/me/tax-rates", headers=h)).json()
    assert rates["country"] == "MA" and rates["rates"][0] == 20
    r = await client.post("/api/v1/products/", json={"name_fr": "X", "name_ar": "Y", "tax_rate": 150}, headers=h)
    assert r.status_code == 422
