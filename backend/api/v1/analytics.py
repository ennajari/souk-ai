from datetime import datetime, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import case, func, select

from core.database import get_db
from core.deps import get_current_merchant
from core.money import to_money
from core.timeutil import day_start_utc, days_in_month, local_date, local_today, merchant_zone, month_start
from models.merchant import Merchant
from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionType
from models.supplier_order import SupplierOrder
from models.employee_contract import EmployeeContract
from schemas.analytics import DashboardStats, SalesChartPoint, ProductProfit, ProfitSummary

router = APIRouter(prefix="/analytics", tags=["analytics"])

MAX_SALES_CHART_DAYS = 90
MAX_PROFIT_DAYS = 365


def _signed(col):
    """+col for a SALE, -col for a RETURN: every figure below is net of returns."""
    return case((Transaction.type == TransactionType.RETURN, -col), else_=col)


_SALES_AND_RETURNS = Transaction.type.in_([TransactionType.SALE, TransactionType.RETURN])
# Cost frozen at sale time; rows from before that column existed fall back to the current cost
_UNIT_COST = func.coalesce(Transaction.unit_cost, Product.cost_price)


async def _net_sales(db: AsyncSession, merchant_id: str, since: datetime, until: datetime | None = None):
    """(number of sale lines, revenue net of returns, cost of goods sold net of returns)."""
    q = (
        select(
            func.count(Transaction.id).filter(Transaction.type == TransactionType.SALE),
            func.coalesce(func.sum(_signed(Transaction.total_amount)), 0),
            func.coalesce(func.sum(_signed(Transaction.quantity * _UNIT_COST)), 0),
        )
        .join(Product, Product.id == Transaction.product_id)
        .where(Transaction.merchant_id == merchant_id, _SALES_AND_RETURNS, Transaction.created_at >= since)
    )
    if until is not None:
        q = q.where(Transaction.created_at < until)
    count, revenue, cogs = (await db.execute(q)).one()
    return int(count or 0), float(revenue or 0), float(cogs or 0)


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # "Today" and "this month" are the merchant's local day/month, not UTC (AUDIT pass 2)
    zone = merchant_zone(merchant)
    today = local_today(zone)
    today_start = day_start_utc(today, zone)
    month_start_ = day_start_utc(month_start(today), zone)

    total_products = (await db.execute(
        select(func.count(Product.id)).where(Product.merchant_id == merchant.id, Product.is_active == True)
    )).scalar() or 0
    total_sales_today, total_revenue_today, _ = await _net_sales(db, merchant.id, today_start)
    total_sales_month, total_revenue_month, _ = await _net_sales(db, merchant.id, month_start_)
    low_stock_count = (await db.execute(
        select(func.count(Inventory.id)).join(Product)
        .where(Product.merchant_id == merchant.id, Product.is_active == True,
               Inventory.quantity <= Inventory.reorder_threshold)
    )).scalar() or 0

    return DashboardStats(
        total_products=total_products,
        total_revenue_today=round(total_revenue_today, 2),
        total_sales_today=total_sales_today,
        low_stock_count=low_stock_count,
        total_revenue_month=round(total_revenue_month, 2),
        total_sales_month=total_sales_month,
    )


@router.get("/sales-chart", response_model=list[SalesChartPoint])
async def get_sales_chart(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(7, ge=1, le=MAX_SALES_CHART_DAYS),
):
    """Net revenue per local calendar day, today included, oldest first."""
    zone = merchant_zone(merchant)
    today = local_today(zone)
    first_day = today - timedelta(days=days - 1)
    rows = (await db.execute(
        select(Transaction.created_at, Transaction.type, Transaction.total_amount).where(
            Transaction.merchant_id == merchant.id, _SALES_AND_RETURNS,
            Transaction.created_at >= day_start_utc(first_day, zone),
        )
    )).all()
    daily: dict[str, dict] = defaultdict(lambda: {"revenue": 0.0, "count": 0})
    for created_at, ttype, amount in rows:
        d = daily[local_date(created_at, zone).isoformat()]
        if ttype == TransactionType.RETURN:
            d["revenue"] -= float(amount)
        else:
            d["revenue"] += float(amount)
            d["count"] += 1
    points = []
    for i in range(days):
        key = (first_day + timedelta(days=i)).isoformat()
        points.append(SalesChartPoint(date=key, revenue=round(daily[key]["revenue"], 2), count=daily[key]["count"]))
    return points


@router.get("/profit", response_model=ProfitSummary)
async def get_profit_analysis(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(30, ge=1, le=MAX_PROFIT_DAYS),
):
    """Gross margin per product over `days` local days: net of returns, at the cost frozen at sale time."""
    zone = merchant_zone(merchant)
    since = day_start_utc(local_today(zone) - timedelta(days=days - 1), zone)
    rows = (await db.execute(
        select(
            Product.id, Product.name_fr, Product.name_ar,
            func.sum(_signed(Transaction.quantity)),
            func.sum(_signed(Transaction.total_amount)),
            func.sum(_signed(Transaction.quantity * _UNIT_COST)),
        )
        .join(Product, Product.id == Transaction.product_id)
        .where(Transaction.merchant_id == merchant.id, _SALES_AND_RETURNS, Transaction.created_at >= since)
        .group_by(Product.id, Product.name_fr, Product.name_ar)
    )).all()

    products = []
    for pid, name_fr, name_ar, qty, revenue, cost in rows:
        revenue, cost = float(revenue or 0), float(cost or 0)
        if not qty and not revenue:
            continue  # fully returned
        profit = revenue - cost
        products.append(ProductProfit(
            product_id=pid, name_fr=name_fr or "-", name_ar=name_ar or "-",
            quantity_sold=int(qty or 0), revenue=round(revenue, 2), cost_total=round(cost, 2),
            profit=round(profit, 2), margin_pct=round(profit / revenue * 100, 1) if revenue > 0 else 0,
        ))
    products.sort(key=lambda p: p.profit, reverse=True)
    total_revenue = sum(p.revenue for p in products)
    total_cost = sum(p.cost_total for p in products)
    total_profit = total_revenue - total_cost
    return ProfitSummary(
        total_revenue=round(total_revenue, 2),
        total_cost=round(total_cost, 2),
        total_profit=round(total_profit, 2),
        avg_margin=round(total_profit / total_revenue * 100, 1) if total_revenue > 0 else 0,
        products=products,
    )


@router.get("/monthly-revenue")
async def get_monthly_revenue(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    months: int = Query(1, ge=1, le=12),
):
    """Net profit over the current month (+ previous months): sales − returns − cost of goods sold − salaries.

    Supplier payments are NOT subtracted: buying stock turns cash into inventory, and that cost is
    already counted when the goods are sold (COGS). Subtracting both counted it twice (AUDIT pass 2).
    They are still returned as `total_supplier_costs` (cash out). The current month's salaries are
    prorated to the days elapsed, so profit isn't shown negative on the 2nd of the month.
    """
    zone = merchant_zone(merchant)
    today = local_today(zone)
    start = day_start_utc(month_start(today, months - 1), zone)
    _, total_sales, total_cogs = await _net_sales(db, merchant.id, start)

    total_supplier_costs = float((await db.execute(
        select(func.coalesce(func.sum(SupplierOrder.total_amount), 0)).where(
            SupplierOrder.merchant_id == merchant.id,
            SupplierOrder.payment_id != None,
            SupplierOrder.created_at >= start,
        )
    )).scalar() or 0)
    monthly_salaries = float((await db.execute(
        select(func.coalesce(func.sum(EmployeeContract.salary), 0)).where(
            EmployeeContract.merchant_id == merchant.id,
            EmployeeContract.is_active == True,
        )
    )).scalar() or 0)
    total_salaries = monthly_salaries * ((months - 1) + today.day / days_in_month(today))

    net_revenue = total_sales - total_cogs - total_salaries
    return {
        "period_months": months,
        "total_sales": round(total_sales, 2),
        "total_cogs": round(total_cogs, 2),
        "total_supplier_costs": round(total_supplier_costs, 2),
        "total_salaries": round(total_salaries, 2),
        "net_revenue": round(net_revenue, 2),
        "breakdown": {
            "ventes": round(total_sales, 2),
            "cout_marchandises": round(total_cogs, 2),
            "fournisseurs": round(total_supplier_costs, 2),  # informatif (sortie de trésorerie), pas une charge
            "salaires": round(total_salaries, 2),
            "benefice_net": round(net_revenue, 2),
        },
    }


@router.get("/money-report")
async def money_report(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Money to recover (credit book) and money lost / at risk (expiry, dead stock, stock-outs)."""
    from services.money_report import build_money_report
    today = local_today(merchant_zone(merchant))
    return {"currency": merchant.currency or "MAD", **await build_money_report(db, merchant.id, today=today)}



@router.get("/tax-summary")
async def tax_summary(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    month_offset: int = Query(0, ge=0, le=24, description="0 = current month, 1 = previous month…"),
):
    """VAT collected per rate for a calendar month, net of returns (prices are tax-inclusive).

    tax = gross × rate / (100 + rate). Lines without a rate are reported separately as `unset`
    so the merchant sees what still needs a rate before filing.
    """
    zone = merchant_zone(merchant)
    start_day = month_start(local_today(zone), month_offset)
    end_day = month_start(start_day.replace(day=28) + timedelta(days=7))  # first day of next month
    rows = (await db.execute(
        select(Transaction.tax_rate, func.coalesce(func.sum(_signed(Transaction.total_amount)), 0))
        .where(Transaction.merchant_id == merchant.id, _SALES_AND_RETURNS,
               Transaction.created_at >= day_start_utc(start_day, zone),
               Transaction.created_at < day_start_utc(end_day, zone))
        .group_by(Transaction.tax_rate)
    )).all()
    lines, unset = [], 0.0
    for rate, gross in rows:
        gross = Decimal(str(gross))
        if rate is None:
            unset = float(gross)
            continue
        rate = Decimal(str(rate))
        tax = to_money(gross * rate / (100 + rate))
        lines.append({"rate": float(rate), "gross": float(gross), "tax": float(tax), "net": float(gross - tax)})
    lines.sort(key=lambda x: -x["rate"])
    return {
        "period": start_day.strftime("%Y-%m"),
        "currency": merchant.currency or "MAD",
        "lines": lines,
        "total_tax": round(sum(x["tax"] for x in lines), 2),
        "gross_without_rate": round(unset, 2),
    }
