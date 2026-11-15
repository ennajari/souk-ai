"""Accountant exports: Excel-friendly CSV, figures identical to the Reports screens."""
import csv
import io

from tests.conftest import make_product, register

BULK = "/api/v1/transactions/bulk"


def _rows(resp):
    assert resp.status_code == 200, resp.text
    text = resp.content.decode("utf-8")
    assert text.startswith("﻿")  # BOM: Excel shows Arabic/accents correctly
    return list(csv.reader(io.StringIO(text.lstrip("﻿")), delimiter=";"))


async def test_sales_journal_has_vat_split_and_negative_returns(client):
    h = await register(client)
    soda = await make_product(client, h, stock=20, price=12, tax_rate=20, name_fr="Soda", name_ar="مشروب")
    bread = await make_product(client, h, stock=20, price=1.5, name_fr="Pain", name_ar="خبز")
    sale = (await client.post(BULK, json={"items": [{"product_id": soda["id"], "quantity": 2, "unit_price": 12},
                                                    {"product_id": bread["id"], "quantity": 4, "unit_price": 1.5}]},
                              headers=h)).json()
    await client.post(f"/api/v1/transactions/{sale[0]['id']}/return", headers=h)
    rows = _rows(await client.get("/api/v1/export/sales-journal", headers=h))
    assert rows[0][:5] == ["Date", "Heure", "Reference", "Type", "Produit"]
    by_type = {(r[3], r[4]): r for r in rows[1:]}
    assert by_type[("Vente", "Soda")][7:] == ["24,00", "20", "4,00", "20,00"]
    assert by_type[("Retour", "Soda")][7:] == ["-24,00", "20", "-4,00", "-20,00"]
    assert by_type[("Vente", "Pain")][8:] == ["", "", ""]  # no rate set: no VAT split invented


async def test_profit_export_matches_reports_screen(client):
    h = await register(client)
    p = await make_product(client, h, stock=50, price=10, cost_price=6)
    for qty in (5, 2):
        await client.post(BULK, json={"items": [{"product_id": p["id"], "quantity": qty, "unit_price": 10}]}, headers=h)
    last = (await client.get("/api/v1/transactions/", headers=h)).json()[0]
    await client.post(f"/api/v1/transactions/{last['id']}/return", headers=h)
    screen = (await client.get("/api/v1/analytics/profit", headers=h)).json()
    total = _rows(await client.get("/api/v1/export/profit", headers=h))[-1]
    assert total[0] == "TOTAL"
    assert total[2:5] == [f"{screen[k]:.2f}".replace(".", ",") for k in ("total_revenue", "total_cost", "total_profit")]
