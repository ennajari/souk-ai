from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from models.transaction import Transaction, TransactionType

async def calculate_credit_score(db: AsyncSession, merchant_id: str) -> Dict[str, Any]:
    """
    Compute dynamic credit score based on:
    - Base score (starts at 500)
    - Sales volume last 30 days (+ up to 200 points)
    - Activity consistency (days active out of last 30) (+ up to 200 points)
    - Total history length (+ up to 100 points max)
    """
    now = datetime.now(timezone.utc)
    lookback_30 = now - timedelta(days=30)
    
    # Base score
    score = 500
    factors = {}
    
    # Get last 30 days transactions
    result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant_id,
            Transaction.type.in_([TransactionType.SALE, TransactionType.RETURN]),
            Transaction.created_at >= lookback_30
        )
    )
    all_txns = result.scalars().all()
    txns = [t for t in all_txns if t.type == TransactionType.SALE]
    returned = sum(float(t.total_amount) for t in all_txns if t.type == TransactionType.RETURN)

    # 1. Volume Factor — net of returns, otherwise sell+return loops inflate the score (AUDIT L7)
    total_sales_value = max(0.0, sum(float(t.total_amount) for t in txns) - returned)
    # Give 1 point for every 100 MAD sold, max 200 points (20,000 MAD)
    volume_points = min(200, int(total_sales_value / 100))
    score += volume_points
    factors["volume_points"] = volume_points
    factors["total_sales_30d"] = total_sales_value
    
    # 2. Consistency Factor
    active_days = len(set(t.created_at.date() for t in txns))
    # Give (200 / 30) = ~6.6 points per active day
    consistency_points = int(active_days * 6.66)
    score += consistency_points
    factors["consistency_points"] = consistency_points
    factors["active_days_30d"] = active_days
    
    # 3. History Factor (Optional: look at very first transaction)
    oldest_result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant_id
        ).order_by(Transaction.created_at.asc()).limit(1)
    )
    first_txn = oldest_result.scalar_one_or_none()
    
    history_points = 0
    days_on_platform = 0
    if first_txn:
        days_on_platform = (now - first_txn.created_at).days
        # Give 1 point per day, max 100 points
        history_points = min(100, days_on_platform)

    score += history_points
    factors["history_points"] = history_points
    factors["days_on_platform"] = days_on_platform
    
    # Cap score at 1000
    final_score = min(1000, score)
    
    return {
        "score": final_score,
        "factors": factors
    }
