import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.product import Product
from models.transaction import Transaction, TransactionType

router = APIRouter(prefix="/export", tags=["Export"])

CSV_CONTENT_TYPE = "text/csv"


@router.get("/products")
async def export_products_csv(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Product).where(Product.merchant_id == merchant.id, Product.is_active is True)
    )
    products = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Nom FR", "Nom AR", "Code-barres", "Unite", "Prix vente", "Prix achat", "Stock", "Date expiration"])

    for p in products:
        stock = p.inventory.quantity if p.inventory else 0
        writer.writerow([
            p.name_fr, p.name_ar, p.barcode or "", p.unit,
            float(p.unit_price), float(p.cost_price),
            float(stock), p.expiry_date or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type=CSV_CONTENT_TYPE,
        headers={"Content-Disposition": f"attachment; filename=produits_{datetime.now().strftime('%Y%m%d')}.csv"},
    )


@router.get("/transactions")
async def export_transactions_csv(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, le=365),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant.id,
            Transaction.created_at >= since,
        ).order_by(desc(Transaction.created_at))
    )
    txns = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Source", "Produit", "Quantite", "Prix unitaire", "Total"])

    for t in txns:
        prod_res = await db.execute(select(Product).where(Product.id == t.product_id))
        product = prod_res.scalar_one_or_none()
        writer.writerow([
            t.created_at.strftime("%Y-%m-%d %H:%M"),
            t.type.value, t.source.value,
            (product.name_fr if product else "-"),
            t.quantity, float(t.unit_price), float(t.total_amount),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type=CSV_CONTENT_TYPE,
        headers={"Content-Disposition": f"attachment; filename=transactions_{datetime.now().strftime('%Y%m%d')}.csv"},
    )


@router.get("/profit")
async def export_profit_csv(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, le=365),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant.id,
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= since,
        ).order_by(desc(Transaction.created_at))
    )
    txns = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Produit", "Quantite vendue", "CA", "Cout total", "Profit", "Marge %"])

    # Group by product
    product_data = {}
    for t in txns:
        pid = t.product_id
        if pid not in product_data:
            prod_res = await db.execute(select(Product).where(Product.id == pid))
            product = prod_res.scalar_one_or_none()
            product_data[pid] = {
                "name": product.name_fr if product else "-",
                "cost_price": float(product.cost_price) if product else 0,
                "qty": 0, "revenue": 0,
            }
        product_data[pid]["qty"] += t.quantity
        product_data[pid]["revenue"] += float(t.total_amount)

    for pd in product_data.values():
        cost_total = pd["qty"] * pd["cost_price"]
        profit = pd["revenue"] - cost_total
        margin = (profit / pd["revenue"] * 100) if pd["revenue"] > 0 else 0
        writer.writerow([pd["name"], pd["qty"], f"{pd['revenue']:.2f}", f"{cost_total:.2f}", f"{profit:.2f}", f"{margin:.1f}"])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type=CSV_CONTENT_TYPE,
        headers={"Content-Disposition": f"attachment; filename=profit_{datetime.now().strftime('%Y%m%d')}.csv"},
    )
