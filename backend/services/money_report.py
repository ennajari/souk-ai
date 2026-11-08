"""Where is my money?" — the report a shopkeeper actually acts on (AUDIT U3).

Two numbers, each broken down into concrete actions:
- to_recover: money customers owe (credit book).
- lost / at risk: expired stock, stock about to expire, dead stock, sales lost to stock-outs.
Values are at cost price (what the merchant paid), except lost sales (margin not earned).
"""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.money import to_money
from models.customer import Customer
from models.inventory import Inventory
from models.product import Product
from models.transaction import Transaction, TransactionType

EXPIRY_WINDOW_DAYS = 7
DEAD_STOCK_DAYS = 30
LOOKBACK_DAYS = 30


def _line(product: Product, qty, value: Decimal, **extra) -> dict:
    return {"product_id": product.id, "name": product.name_fr or product.name_ar,
            "quantity": float(qty), "value": float(value), **extra}


async def build_money_report(db: AsyncSession, merchant_id: str, today: date | None = None) -> dict:
    today = today or datetime.now(timezone.utc).date()
    since = datetime.combine(today - timedelta(days=LOOKBACK_DAYS), datetime.min.time(), tzinfo=timezone.utc)

    debtors = (await db.execute(
        select(Customer).where(Customer.merchant_id == merchant_id, Customer.is_active == True,
                               Customer.balance > 0).order_by(Customer.balance.desc())
    )).scalars().all()
    to_recover = sum((to_money(c.balance) for c in debtors), Decimal("0"))

    rows = (await db.execute(
        select(Product, Inventory).join(Inventory, Inventory.product_id == Product.id)
        .where(Product.merchant_id == merchant_id, Product.is_active == True)
    )).all()
    sold = defaultdict(float)
    last_sale: dict[str, datetime] = {}
    for pid, qty, last in (await db.execute(
        select(Transaction.product_id, func.sum(Transaction.quantity), func.max(Transaction.created_at))
        .where(Transaction.merchant_id == merchant_id, Transaction.type == TransactionType.SALE,
               Transaction.created_at >= since)
        .group_by(Transaction.product_id)
    )).all():
        sold[pid], last_sale[pid] = float(qty), last

    expired, expiring, dead, stockouts = [], [], [], []
    for p, inv in rows:
        qty, cost = to_money(inv.quantity), to_money(p.cost_price)
        if qty > 0 and p.expiry_date and p.expiry_date < today:
            expired.append(_line(p, qty, qty * cost, expiry_date=p.expiry_date.isoformat()))
        elif qty > 0 and p.expiry_date and p.expiry_date <= today + timedelta(days=EXPIRY_WINDOW_DAYS):
            expiring.append(_line(p, qty, qty * cost, expiry_date=p.expiry_date.isoformat(),
                                  days_left=(p.expiry_date - today).days))
        elif qty > 0 and p.id not in sold and p.created_at.date() <= today - timedelta(days=DEAD_STOCK_DAYS):
            dead.append(_line(p, qty, qty * cost))
        if qty <= 0 and sold.get(p.id):
            margin = max(Decimal("0"), to_money(p.unit_price) - cost)
            per_week = to_money(Decimal(str(sold[p.id] / LOOKBACK_DAYS * 7)) * margin)
            stockouts.append(_line(p, qty, per_week, daily_sales=round(sold[p.id] / LOOKBACK_DAYS, 2)))

    def total(lines):
        return float(sum((Decimal(str(x["value"])) for x in lines), Decimal("0")))

    for lines in (expired, expiring, dead, stockouts):
        lines.sort(key=lambda x: -x["value"])
    oldest = None
    if debtors:
        oldest = min((e.created_at for c in debtors for e in c.entries), default=None)
    return {
        "to_recover": {
            "total": float(to_recover),
            "customers": len(debtors),
            "oldest_debt_days": (today - oldest.date()).days if oldest else None,
            "top": [{"customer_id": c.id, "name": c.name, "phone": c.phone, "balance": float(c.balance)}
                    for c in debtors[:5]],
        },
        "lost": {"total": total(expired), "expired": expired[:10]},
        "at_risk": {
            "total": total(expiring) + total(dead),
            "expiring_soon": expiring[:10],
            "dead_stock": dead[:10],
        },
        "missed_sales_per_week": {"total": total(stockouts), "out_of_stock": stockouts[:10]},
    }
