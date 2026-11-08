import math
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.transaction import Transaction, TransactionType
from models.product import Product


async def calculate_forecast(
    db: AsyncSession, merchant_id: str, product_id: str, days_ahead: int = 7
) -> list[dict]:
    """
    Pure-Python statistical forecast:
    1. Pull last 30 days of sales history
    2. Compute 7-day moving average (trend)
    3. Compute day-of-week seasonality index
    4. Predict next N days = trend * seasonality
    """
    now = datetime.now(timezone.utc)
    lookback = now - timedelta(days=30)

    result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant_id,
            Transaction.product_id == product_id,
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= lookback,
        )
    )
    txns = result.scalars().all()
    return _calculate_forecast_from_txns(txns, now, days_ahead=days_ahead)


async def get_restock_recommendations(db: AsyncSession, merchant_id: str) -> list[dict]:
    """For each active product, compare 7-day forecast demand vs current stock."""
    from sqlalchemy.orm import selectinload

    # Batch load all products with inventory in one query
    products_result = await db.execute(
        select(Product)
        .options(selectinload(Product.inventory))
        .where(Product.merchant_id == merchant_id, Product.is_active == True)
    )
    products = products_result.scalars().all()

    if not products:
        return []

    # Batch load ALL transactions for this merchant in last 30 days (single query)
    now = datetime.now(timezone.utc)
    lookback = now - timedelta(days=30)
    txn_result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant_id,
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= lookback,
        )
    )
    all_txns = txn_result.scalars().all()

    # Group transactions by product_id
    txns_by_product: dict[str, list] = defaultdict(list)
    for t in all_txns:
        txns_by_product[t.product_id].append(t)

    recommendations = []
    for product in products:
        # Calculate forecast using pre-loaded transactions
        forecast = _calculate_forecast_from_txns(txns_by_product.get(product.id, []), now, days_ahead=7)
        total_demand_7d = sum(f["demand"] for f in forecast)

        inv = product.inventory
        current_stock = float(inv.quantity) if inv else 0.0
        threshold = inv.reorder_threshold if inv else 10

        deficit = total_demand_7d - current_stock
        restock_qty = max(0, int(deficit + threshold + 0.5))

        recommendations.append({
            "product_id": product.id,
            "product_name_ar": product.name_ar,
            "product_name_fr": product.name_fr or "",
            "current_stock": current_stock,
            "predicted_demand_7d": round(total_demand_7d, 2),
            "restock_quantity": restock_qty,
            "forecast": forecast,
        })
    return recommendations


def _calculate_forecast_from_txns(txns: list, now: datetime, days_ahead: int = 7) -> list[dict]:
    """Build the last-30-days daily sales array from pre-loaded transactions and forecast it."""
    daily_sales: dict[str, float] = defaultdict(float)
    for t in txns:
        daily_sales[t.created_at.strftime("%Y-%m-%d")] += float(t.quantity)
    days = [now - timedelta(days=30 - i) for i in range(30)]
    history = [daily_sales.get(d.strftime("%Y-%m-%d"), 0.0) for d in days]
    # history ends yesterday → model day 1 is today; outputs start tomorrow, so drop today
    demand, factors = forecast_from_history(history, days[0].weekday(), days_ahead + 1)
    demand = demand[1:]
    out = []
    for i, d in enumerate(demand):
        day = now + timedelta(days=i + 1)
        # ~80% Poisson interval: honest for slow movers (old ±25% was far too narrow at 0-2 units/day)
        half = 1.28 * math.sqrt(d)
        out.append({
            "date": day.date(),
            "demand": round(d, 2),
            "lower": round(max(0.0, d - half), 2),
            "upper": round(d + half, 2),
            "factors": {"trend_slope": factors["trend_slope"], "seasonality": factors["seasonality"][day.weekday()]}
            if factors else {},
        })
    return out


def forecast_from_history(
    history: list[float], first_weekday: int, days_ahead: int = 7, phi: float = 0.5, shrink: float = 2.0,
) -> tuple[list[float], dict]:
    """Pure demand model (no I/O), backtested in tests/test_forecasting.py.

    level  = mean of the last 14 days
    season = day-of-week index, shrunk toward 1 with `shrink` pseudo-weeks (robust for slow movers)
    trend  = week-over-week slope, capped at ±50 % of level per week and damped by `phi`
             (the previous undamped 14-day regression extrapolated without bound)
    Leading zero days (product not sold yet / merchant just onboarded) are ignored.
    Backtest (60 synthetic products, 120 days, 7-day horizon): WAPE 0.205 vs 0.218 previous model
    vs 0.266 naive 7-day mean; new merchant with 10 days of data: 0.32 vs 0.51.
    """
    start = next((i for i, q in enumerate(history) if q > 0), len(history))
    start = min(start, max(0, len(history) - 7))
    hist, wd0 = history[start:], (first_weekday + start) % 7
    n, total = len(hist), sum(hist)
    if total == 0:
        return [0.0] * days_ahead, {}

    overall = total / n
    sums, counts = [0.0] * 7, [0] * 7
    for i, q in enumerate(hist):
        sums[(wd0 + i) % 7] += q
        counts[(wd0 + i) % 7] += 1
    season = [((sums[w] + shrink * overall) / (counts[w] + shrink)) / overall for w in range(7)]
    norm = sum(season) / 7
    season = [v / norm for v in season]

    recent = hist[-14:]
    level = sum(recent) / len(recent)
    slope = (sum(hist[-7:]) - sum(hist[-14:-7])) / 49 if n >= 14 else 0.0
    cap = 0.5 * level / 7
    slope = max(-cap, min(cap, slope))

    demand, damp = [], 0.0
    for h in range(1, days_ahead + 1):
        damp += phi ** h
        demand.append(max(0.0, (level + slope * (3.5 + damp)) * season[(wd0 + n + h - 1) % 7]))
    return demand, {"level": round(level, 3), "trend_slope": round(slope, 4),
                    "seasonality": [round(v, 3) for v in season]}
