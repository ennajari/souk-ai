import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.product import Product
from models.transaction import Transaction, TransactionType
from core.money import to_money
from core.timeutil import day_start_utc, local_today, merchant_zone, month_start
from decimal import Decimal

router = APIRouter(prefix="/export", tags=["Export"])

CSV_CONTENT_TYPE = "text/csv; charset=utf-8"


def _csv(header: list[str], rows, filename: str) -> StreamingResponse:
    """Excel-friendly CSV: UTF-8 BOM (Arabic names and accents display correctly) and ';' separator
    (what Excel expects with French/Arabic regional settings)."""
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";")
    writer.writerow(header)
    writer.writerows(rows)
    return StreamingResponse(
        iter([output.getvalue()]), media_type=CSV_CONTENT_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _num(value) -> str:
    return f"{float(value):.2f}".replace(".", ",")  # decimal comma: what accountants' Excel expects


@router.get("/products")
async def export_products_csv(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Product)
        .where(Product.merchant_id == merchant.id, Product.is_active == True)
        .options(selectinload(Product.inventory))
    )
    products = result.scalars().all()

    rows = [[p.name_fr, p.name_ar, p.barcode or "", p.unit, _num(p.unit_price), _num(p.cost_price),
             f"{float(p.inventory.quantity if p.inventory else 0):g}".replace(".", ","), p.expiry_date or ""]
            for p in products]
    return _csv(["Nom FR", "Nom AR", "Code-barres", "Unite", "Prix vente", "Prix achat", "Stock", "Date expiration"],
                rows, f"produits_{datetime.now().strftime('%Y%m%d')}.csv")


@router.get("/transactions")
async def export_transactions_csv(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, le=365),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.product))
        .where(
            Transaction.merchant_id == merchant.id,
            Transaction.created_at >= since,
        ).order_by(desc(Transaction.created_at))
    )
    txns = result.scalars().all()

    zone = merchant_zone(merchant)
    rows = [[t.created_at.astimezone(zone).strftime("%Y-%m-%d %H:%M"), t.type.value, t.source.value,
             (t.product.name_fr if t.product else "-"), f"{float(t.quantity):g}".replace(".", ","),
             _num(t.unit_price), _num(t.total_amount)] for t in txns]
    return _csv(["Date", "Type", "Source", "Produit", "Quantite", "Prix unitaire", "Total"], rows,
                f"transactions_{datetime.now().strftime('%Y%m%d')}.csv")


@router.get("/profit")
async def export_profit_csv(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=1, le=365),
):
    """Same figures as Reports → Margins (net of returns, cost frozen at sale), as CSV."""
    from api.v1.analytics import get_profit_analysis
    summary = await get_profit_analysis(merchant=merchant, db=db, days=days)
    rows = [[p.name_fr, f"{p.quantity_sold:g}", _num(p.revenue), _num(p.cost_total), _num(p.profit),
             f"{p.margin_pct:.1f}".replace(".", ",")] for p in summary.products]
    rows.append(["TOTAL", "", _num(summary.total_revenue), _num(summary.total_cost), _num(summary.total_profit),
                 f"{summary.avg_margin:.1f}".replace(".", ",")])
    return _csv(["Produit", "Quantite vendue", "CA TTC", "Cout", "Marge", "Marge %"], rows,
                f"marges_{datetime.now().strftime('%Y%m%d')}.csv")


@router.get("/sales-journal")
async def export_sales_journal(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    month_offset: int = Query(0, ge=0, le=24),
):
    """Monthly sales journal for the accountant: one line per sale/return line, local date and time,
    tax-inclusive amount split into VAT and net. Returns are negative."""
    zone = merchant_zone(merchant)
    start_day = month_start(local_today(zone), month_offset)
    end_day = month_start(start_day.replace(day=28) + timedelta(days=7))
    rows = (await db.execute(
        select(Transaction, Product.name_fr, Product.name_ar)
        .join(Product, Product.id == Transaction.product_id)
        .where(Transaction.merchant_id == merchant.id,
               Transaction.type.in_([TransactionType.SALE, TransactionType.RETURN]),
               Transaction.created_at >= day_start_utc(start_day, zone),
               Transaction.created_at < day_start_utc(end_day, zone))
        .order_by(Transaction.created_at)
    )).all()
    out = []
    for t, name_fr, name_ar in rows:
        sign = -1 if t.type == TransactionType.RETURN else 1
        gross = to_money(t.total_amount) * sign
        rate = Decimal(str(t.tax_rate)) if t.tax_rate is not None else None
        tax = to_money(gross * rate / (100 + rate)) if rate is not None else None
        local = t.created_at.astimezone(zone)
        out.append([
            local.strftime("%Y-%m-%d"), local.strftime("%H:%M"), t.id[:8].upper(),
            "Vente" if sign > 0 else "Retour", name_fr or name_ar, f"{float(t.quantity) * sign:g}".replace(".", ","),
            _num(t.unit_price), _num(gross),
            "" if rate is None else f"{rate.normalize():f}".replace(".", ","),
            "" if tax is None else _num(tax), "" if tax is None else _num(gross - tax),
        ])
    return _csv(
        ["Date", "Heure", "Reference", "Type", "Produit", "Quantite", "Prix unitaire TTC", "Montant TTC",
         "Taux TVA %", "TVA", "Montant HT"],
        out, f"journal_ventes_{start_day.strftime('%Y-%m')}.csv",
    )
