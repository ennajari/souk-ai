from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.deps import get_current_merchant, check_is_admin
from models.merchant import Merchant
from app.config import settings
from models.product import Product
from models.transaction import Transaction, TransactionType
from models.customer import Customer
from models.employee import Employee
from models.credit_request import CreditRequest, CreditRequestStatus

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def admin_stats(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Global stats for the founder/admin monitoring dashboard."""
    if not check_is_admin(merchant):
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
        .where(Transaction.created_at >= today, Transaction.type == TransactionType.SALE)
    )).scalar() or 0

    # Revenue this month (all merchants)
    revenue_month = (await db.execute(
        select(func.coalesce(func.sum(Transaction.total_amount), 0))
        .where(Transaction.created_at >= month_ago, Transaction.type == TransactionType.SALE)
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
        .where(Transaction.created_at >= month_ago, Transaction.type == TransactionType.SALE)
        .group_by(Transaction.merchant_id)
        .order_by(func.sum(Transaction.total_amount).desc())
        .limit(5)
    )
    top_merchants_rows = top_merchants_q.all()

    # Get merchant names in a single query
    top_merchant_ids = [row.merchant_id for row in top_merchants_rows]
    merchants_map: dict = {}
    if top_merchant_ids:
        m_rows = (await db.execute(
            select(Merchant.id, Merchant.business_name).where(Merchant.id.in_(top_merchant_ids))
        )).all()
        merchants_map = {r.id: r.business_name for r in m_rows}
    top_merchants = [
        {
            "merchant_id": row.merchant_id,
            "business_name": merchants_map.get(row.merchant_id, "—"),
            "revenue": float(row.revenue),
            "transactions": row.tx_count,
        }
        for row in top_merchants_rows
    ]

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
            .where(Transaction.created_at >= day_start, Transaction.created_at < day_end, Transaction.type == TransactionType.SALE)
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


@router.get("/credit-requests")
async def list_credit_requests(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Optional[str] = Query(None),
):
    """List all credit requests, optionally filtered by status."""
    if not check_is_admin(merchant):
        raise HTTPException(status_code=403, detail="Acces reserve au fondateur")

    query = (
        select(CreditRequest, Merchant.business_name)
        .join(Merchant, CreditRequest.merchant_id == Merchant.id)
        .order_by(CreditRequest.created_at.desc())
    )

    if status:
        try:
            status_enum = CreditRequestStatus(status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Statut invalide: {status}")
        query = query.where(CreditRequest.status == status_enum)

    rows = (await db.execute(query)).all()

    return [
        {
            "id": cr.id,
            "merchant_id": cr.merchant_id,
            "business_name": business_name,
            "amount": float(cr.amount),
            "term_days": cr.term_days,
            "fee_percentage": float(cr.fee_percentage),
            "status": cr.status.value,
            "admin_note": cr.admin_note,
            "reviewed_at": cr.reviewed_at.isoformat() if cr.reviewed_at else None,
            "created_at": cr.created_at.isoformat(),
        }
        for cr, business_name in rows
    ]


class CreditRequestReview(BaseModel):
    status: str
    admin_note: Optional[str] = None


@router.patch("/credit-requests/{request_id}")
async def review_credit_request(
    request_id: str,
    body: CreditRequestReview,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Approve or reject a credit request."""
    if not check_is_admin(merchant):
        raise HTTPException(status_code=403, detail="Acces reserve au fondateur")

    if body.status not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=400, detail="Statut doit etre APPROVED ou REJECTED")

    result = await db.execute(
        select(CreditRequest).where(CreditRequest.id == request_id)
    )
    credit_request = result.scalar_one_or_none()
    if not credit_request:
        raise HTTPException(status_code=404, detail="Demande de credit introuvable")

    credit_request.status = CreditRequestStatus(body.status)
    credit_request.admin_note = body.admin_note
    credit_request.reviewed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(credit_request)

    return {
        "id": credit_request.id,
        "status": credit_request.status.value,
        "admin_note": credit_request.admin_note,
        "reviewed_at": credit_request.reviewed_at.isoformat(),
    }


@router.get("/merchants")
async def list_merchants(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all merchants with activity summary."""
    if not check_is_admin(merchant):
        raise HTTPException(status_code=403, detail="Acces reserve au fondateur")

    month_ago = datetime.now(timezone.utc) - timedelta(days=30)

    merchants_q = await db.execute(select(Merchant).order_by(Merchant.created_at.desc()))
    merchants = merchants_q.scalars().all()

    result = []
    for m in merchants:
        # Product count
        prod_count = (await db.execute(
            select(func.count(Product.id)).where(Product.merchant_id == m.id)
        )).scalar() or 0

        # Transaction count last 30 days
        tx_count = (await db.execute(
            select(func.count(Transaction.id)).where(
                Transaction.merchant_id == m.id, Transaction.created_at >= month_ago
            )
        )).scalar() or 0

        # Revenue last 30 days
        revenue = (await db.execute(
            select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
                Transaction.merchant_id == m.id,
                Transaction.created_at >= month_ago,
                Transaction.type == TransactionType.SALE,
            )
        )).scalar() or 0

        result.append({
            "id": m.id,
            "business_name": m.business_name,
            "phone_number": m.phone_number,
            "email": m.email,
            "account_type": m.account_type.value if m.account_type else "MERCHANT",
            "business_category": m.business_category.value if m.business_category else "OTHER",
            "credit_score": m.credit_score,
            "is_active": m.is_active,
            "created_at": m.created_at.isoformat(),
            "products": prod_count,
            "transactions_30d": tx_count,
            "revenue_30d": float(revenue),
        })

    return result


@router.get("/cards")
async def list_cards(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all Souk.AI cards."""
    if not check_is_admin(merchant):
        raise HTTPException(status_code=403, detail="Acces reserve au fondateur")

    from models.souk_card import SoukCard

    cards_q = await db.execute(select(SoukCard).order_by(SoukCard.created_at.desc()))
    cards = cards_q.scalars().all()

    return [
        {
            "id": c.id,
            "card_number": c.card_number,
            "holder_name": c.holder_name,
            "holder_phone": c.holder_phone,
            "balance": float(c.balance),
            "card_type": c.card_type.value if c.card_type else "CLIENT",
            "status": c.status.value,
            "nfc_uid": c.nfc_uid,
            "created_at": c.created_at.isoformat(),
        }
        for c in cards
    ]


@router.get("/payments")
async def list_all_payments(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all payments across the platform."""
    if not check_is_admin(merchant):
        raise HTTPException(status_code=403, detail="Acces reserve au fondateur")

    from models.payment import Payment

    payments_q = await db.execute(
        select(Payment, Merchant.business_name)
        .join(Merchant, Payment.merchant_id == Merchant.id)
        .order_by(Payment.created_at.desc())
        .limit(200)
    )
    rows = payments_q.all()

    return [
        {
            "id": p.id,
            "merchant_id": p.merchant_id,
            "business_name": bname,
            "amount": float(p.amount),
            "method": p.method.value if hasattr(p.method, 'value') else str(p.method),
            "status": p.status.value if hasattr(p.status, 'value') else str(p.status),
            "created_at": p.created_at.isoformat(),
        }
        for p, bname in rows
    ]
