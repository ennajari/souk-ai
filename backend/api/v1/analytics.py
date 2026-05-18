from datetime import datetime, timezone, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionType
from schemas.analytics import DashboardStats, SalesChartPoint, ProductProfit, ProfitSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])

MAX_SALES_CHART_DAYS = 90
MAX_PROFIT_DAYS = 365


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Total products
    prod_result = await db.execute(
        select(func.count(Product.id)).where(
            Product.merchant_id == merchant.id, Product.is_active == True
        )
    )
    total_products = prod_result.scalar() or 0

    # Today's sales
    today_result = await db.execute(
        select(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.total_amount), 0),
        ).where(
            Transaction.merchant_id == merchant.id,
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= today_start,
        )
    )
    row = today_result.one()
    total_sales_today = row[0] or 0
    total_revenue_today = float(row[1] or 0)

    # Month's sales
    month_result = await db.execute(
        select(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.total_amount), 0),
        ).where(
            Transaction.merchant_id == merchant.id,
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= month_start,
        )
    )
    mrow = month_result.one()
    total_sales_month = mrow[0] or 0
    total_revenue_month = float(mrow[1] or 0)

    # Low stock count
    inv_result = await db.execute(
        select(Inventory)
        .join(Product)
        .where(Product.merchant_id == merchant.id, Product.is_active == True)
    )
    inventories = inv_result.scalars().all()
    low_stock_count = sum(1 for i in inventories if float(i.quantity) <= i.reorder_threshold)

    return DashboardStats(
        total_products=total_products,
        total_revenue_today=total_revenue_today,
        total_sales_today=total_sales_today,
        low_stock_count=low_stock_count,
        total_revenue_month=total_revenue_month,
        total_sales_month=total_sales_month,
    )


@router.get("/sales-chart", response_model=list[SalesChartPoint])
async def get_sales_chart(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(7, le=MAX_SALES_CHART_DAYS),
):
    safe_days = min(days, MAX_SALES_CHART_DAYS)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=safe_days)

    result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant.id,
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= start,
        )
    )
    txns = result.scalars().all()

    # Group by date
    daily: dict[str, dict] = {}
    for t in txns:
        day = t.created_at.strftime("%Y-%m-%d")
        if day not in daily:
            daily[day] = {"revenue": 0, "count": 0}
        daily[day]["revenue"] += float(t.total_amount)
        daily[day]["count"] += 1

    # Fill missing days
    points = []
    for i in range(safe_days):
        d = (start + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        data = daily.get(d, {"revenue": 0, "count": 0})
        points.append(SalesChartPoint(date=d, revenue=data["revenue"], count=data["count"]))

    return points


@router.get("/profit", response_model=ProfitSummary)
async def get_profit_analysis(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, le=MAX_PROFIT_DAYS),
):
    safe_days = min(days, MAX_PROFIT_DAYS)
    since = datetime.now(timezone.utc) - timedelta(days=safe_days)

    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.product))
        .where(
            Transaction.merchant_id == merchant.id,
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= since,
        )
    )
    txns = result.scalars().all()

    # Group by product (products already loaded via selectinload — no N+1)
    product_map: dict[str, dict] = {}
    for t in txns:
        pid = t.product_id
        if pid not in product_map:
            product = t.product
            product_map[pid] = {
                "product_id": pid,
                "name_fr": product.name_fr if product else "-",
                "name_ar": product.name_ar if product else "-",
                "cost_price": float(product.cost_price) if product else 0,
                "qty": 0, "revenue": 0,
            }
        product_map[pid]["qty"] += t.quantity
        product_map[pid]["revenue"] += float(t.total_amount)

    products = []
    total_revenue = 0
    total_cost = 0
    for pd in product_map.values():
        cost_total = pd["qty"] * pd["cost_price"]
        profit = pd["revenue"] - cost_total
        margin = (profit / pd["revenue"] * 100) if pd["revenue"] > 0 else 0
        total_revenue += pd["revenue"]
        total_cost += cost_total
        products.append(ProductProfit(
            product_id=pd["product_id"],
            name_fr=pd["name_fr"], name_ar=pd["name_ar"],
            quantity_sold=pd["qty"], revenue=pd["revenue"],
            cost_total=cost_total, profit=profit, margin_pct=round(margin, 1),
        ))

    # Sort by profit descending
    products.sort(key=lambda p: p.profit, reverse=True)
    total_profit = total_revenue - total_cost
    avg_margin = (total_profit / total_revenue * 100) if total_revenue > 0 else 0

    return ProfitSummary(
        total_revenue=round(total_revenue, 2),
        total_cost=round(total_cost, 2),
        total_profit=round(total_profit, 2),
        avg_margin=round(avg_margin, 1),
        products=products,
    )
