from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from app.config import settings
from models.product import Product
from models.transaction import Transaction
from models.customer import Customer
from models.employee import Employee

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def admin_stats(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """Global stats for the founder/admin monitoring dashboard."""
    if merchant.phone_number != settings.ADMIN_PHONE:
        raise HTTPException(status_code=403, detail="Acces reserve au fondateur")
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Total merchants
    total_merchants = (await db.execute(select(func.count(Merchant.id)))).scalar() or 0

    # Merchants created this week
    new_merchants_week = (await db.execute(
        select(func.count(Merchant.id)).where(Merchant.created_at >= week_ago)
    )).scalar() or 0

    # Merchants created this month
    new_merchants_month = (await db.execute(
        select(func.count(Merchant.id)).where(Merchant.created_at >= month_ago)
    )).scalar() or 0

    # Total products across all merchants
    total_products = (await db.execute(select(func.count(Product.id)))).scalar() or 0

    # Total transactions
    total_transactions = (await db.execute(select(func.count(Transaction.id)))).scalar() or 0

    # Transactions today
    transactions_today = (await db.execute(
        select(func.count(Transaction.id)).where(Transaction.created_at >= today)
    )).scalar() or 0

    # Transactions this week
    transactions_week = (await db.execute(
        select(func.count(Transaction.id)).where(Transaction.created_at >= week_ago)
    )).scalar() or 0

    # Revenue today (all merchants)
    revenue_today = (await db.execute(
        select(func.coalesce(func.sum(Transaction.total_amount), 0))
        .where(Transaction.created_at >= today, Transaction.type == "SALE")
    )).scalar() or 0

    # Revenue this month (all merchants)
    revenue_month = (await db.execute(
        select(func.coalesce(func.sum(Transaction.total_amount), 0))
        .where(Transaction.created_at >= month_ago, Transaction.type == "SALE")
    )).scalar() or 0

    # Total customers
    total_customers = (await db.execute(select(func.count(Customer.id)))).scalar() or 0

    # Total employees
    total_employees = (await db.execute(
        select(func.count(Employee.id)).where(Employee.is_active == True)
    )).scalar() or 0

    # Active merchants (had a transaction in last 7 days)
    active_merchants = (await db.execute(
        select(func.count(func.distinct(Transaction.merchant_id)))
        .where(Transaction.created_at >= week_ago)
    )).scalar() or 0

    # Top 5 merchants by revenue this month
    top_merchants_q = await db.execute(
        select(
            Transaction.merchant_id,
            func.sum(Transaction.total_amount).label("revenue"),
            func.count(Transaction.id).label("tx_count"),
        )
        .where(Transaction.created_at >= month_ago, Transaction.type == "SALE")
        .group_by(Transaction.merchant_id)
        .order_by(func.sum(Transaction.total_amount).desc())
        .limit(5)
    )
    top_merchants_rows = top_merchants_q.all()

    # Get merchant names for top merchants
    top_merchants = []
    for row in top_merchants_rows:
        m = (await db.execute(select(Merchant).where(Merchant.id == row.merchant_id))).scalar_one_or_none()
        top_merchants.append({
            "merchant_id": row.merchant_id,
            "business_name": m.business_name if m else "—",
            "revenue": float(row.revenue),
            "transactions": row.tx_count,
        })

    # Transactions per day (last 7 days)
    daily_activity = []
    for i in range(7):
        day_start = (now - timedelta(days=6 - i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_count = (await db.execute(
            select(func.count(Transaction.id))
            .where(Transaction.created_at >= day_start, Transaction.created_at < day_end)
        )).scalar() or 0
        day_revenue = (await db.execute(
            select(func.coalesce(func.sum(Transaction.total_amount), 0))
            .where(Transaction.created_at >= day_start, Transaction.created_at < day_end, Transaction.type == "SALE")
        )).scalar() or 0
        daily_activity.append({
            "date": day_start.strftime("%d/%m"),
            "transactions": day_count,
            "revenue": float(day_revenue),
        })

    return {
        "merchants": {
            "total": total_merchants,
            "new_this_week": new_merchants_week,
            "new_this_month": new_merchants_month,
            "active_this_week": active_merchants,
        },
        "transactions": {
            "total": total_transactions,
            "today": transactions_today,
            "this_week": transactions_week,
        },
        "revenue": {
            "today": float(revenue_today),
            "this_month": float(revenue_month),
        },
        "counts": {
            "products": total_products,
            "customers": total_customers,
            "employees": total_employees,
        },
        "top_merchants": top_merchants,
        "daily_activity": daily_activity,
        "system": {
            "api": True,
            "database": True,
            "timestamp": now.isoformat(),
        },
    }
