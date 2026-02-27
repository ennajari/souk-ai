from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionType
from schemas.analytics import DashboardStats, SalesChartPoint

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
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
    days: int = Query(7, le=90),
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

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
    for i in range(days):
        d = (start + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        data = daily.get(d, {"revenue": 0, "count": 0})
        points.append(SalesChartPoint(date=d, revenue=data["revenue"], count=data["count"]))

    return points
