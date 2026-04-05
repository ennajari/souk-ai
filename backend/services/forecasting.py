from datetime import datetime, timezone, timedelta
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.transaction import Transaction, TransactionType
from models.product import Product
from models.inventory import Inventory


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

    # Group by date
    daily_sales: dict[str, float] = defaultdict(float)
    for t in txns:
        day_str = t.created_at.strftime("%Y-%m-%d")
        daily_sales[day_str] += float(t.quantity)

    # Build 30-day history array
    history = []
    for i in range(30):
        d = now - timedelta(days=30 - i)
        day_str = d.strftime("%Y-%m-%d")
        history.append(daily_sales.get(day_str, 0.0))

    total_historical = sum(history)
    if total_historical == 0:
        # No sales data — return zero forecasts
        return [
            {"date": (now + timedelta(days=i + 1)).date(), "demand": 0.0, "lower": 0.0, "upper": 0.0, "factors": {}}
            for i in range(days_ahead)
        ]

    # 7-day moving average as baseline
    recent_window = history[-7:]
    avg_daily = sum(recent_window) / 7 if sum(recent_window) > 0 else (total_historical / 30)

    # Day-of-week seasonality: average sales per weekday (0=Mon…6=Sun)
    weekday_totals: dict[int, float] = defaultdict(float)
    weekday_counts: dict[int, int] = defaultdict(int)
    for i, qty in enumerate(history):
        d = now - timedelta(days=30 - i)
        wd = d.weekday()
        weekday_totals[wd] += qty
        weekday_counts[wd] += 1

    overall_avg = total_historical / 30
    seasonality: dict[int, float] = {}
    for wd in range(7):
        if weekday_counts[wd] > 0 and overall_avg > 0:
            seasonality[wd] = (weekday_totals[wd] / weekday_counts[wd]) / overall_avg
        else:
            seasonality[wd] = 1.0

    # Linear trend: simple least squares over last 14 days
    window = history[-14:]
    n = len(window)
    if n >= 2:
        x_mean = (n - 1) / 2
        y_mean = sum(window) / n
        numerator = sum((i - x_mean) * (window[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        slope = numerator / denominator if denominator != 0 else 0.0
    else:
        slope = 0.0

    # Generate forecasts
    forecasts = []
    for i in range(days_ahead):
        future_date = now + timedelta(days=i + 1)
        wd = future_date.weekday()
        trend_adjustment = avg_daily + slope * (i + 1)
        predicted = max(0.0, trend_adjustment * seasonality.get(wd, 1.0))
        margin = predicted * 0.25  # ±25% confidence interval
        forecasts.append({
            "date": future_date.date(),
            "demand": round(predicted, 2),
            "lower": round(max(0.0, predicted - margin), 2),
            "upper": round(predicted + margin, 2),
            "factors": {"trend_slope": round(slope, 4), "seasonality": round(seasonality.get(wd, 1.0), 3)},
        })

    return forecasts


async def get_restock_recommendations(db: AsyncSession, merchant_id: str) -> list[dict]:
    """For each active product, compare 7-day forecast demand vs current stock."""
    products_result = await db.execute(
        select(Product).where(Product.merchant_id == merchant_id, Product.is_active is True)
    )
    products = products_result.scalars().all()

    recommendations = []
    for product in products:
        forecast = await calculate_forecast(db, merchant_id, product.id, days_ahead=7)
        total_demand_7d = sum(f["demand"] for f in forecast)

        inv_result = await db.execute(select(Inventory).where(Inventory.product_id == product.id))
        inv = inv_result.scalar_one_or_none()
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
