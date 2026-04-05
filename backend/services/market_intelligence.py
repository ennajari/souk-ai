"""Market intelligence service - cross-merchant analytics and benchmarks."""
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct

from models.merchant import Merchant
from models.product import Product
from models.transaction import Transaction, TransactionType
from models.marketplace import MarketplaceListing


async def get_market_overview(db: AsyncSession) -> dict:
    """Get overall market overview across all merchants."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Total merchants
    merchants_q = await db.execute(select(func.count(Merchant.id)).where(Merchant.is_active is True))
    total_merchants = merchants_q.scalar() or 0

    # Total products
    products_q = await db.execute(select(func.count(Product.id)).where(Product.is_active is True))
    total_products = products_q.scalar() or 0

    # Transactions last 30 days
    tx_q = await db.execute(
        select(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.total_amount), 0),
        ).where(
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= thirty_days_ago,
        )
    )
    tx_row = tx_q.one()
    total_transactions = tx_row[0] or 0
    total_volume = float(tx_row[1] or 0)

    avg_basket = total_volume / total_transactions if total_transactions > 0 else 0

    # Top categories
    cat_q = await db.execute(
        select(Merchant.business_category, func.count(Merchant.id))
        .where(Merchant.is_active is True)
        .group_by(Merchant.business_category)
        .order_by(func.count(Merchant.id).desc())
        .limit(5)
    )
    top_categories = [{"category": row[0].value if hasattr(row[0], 'value') else row[0], "count": row[1]} for row in cat_q.all()]

    # Active cities (from marketplace listings)
    cities_q = await db.execute(
        select(distinct(MarketplaceListing.city))
        .where(MarketplaceListing.city.isnot(None))
        .limit(20)
    )
    active_cities = [row[0] for row in cities_q.all() if row[0]]

    return {
        "total_merchants": total_merchants,
        "total_products": total_products,
        "total_transactions_30d": total_transactions,
        "total_volume_30d": round(total_volume, 2),
        "avg_basket_size": round(avg_basket, 2),
        "top_categories": top_categories,
        "active_cities": active_cities,
    }


async def get_merchant_benchmark(db: AsyncSession, merchant_id: str) -> dict:
    """Compare merchant performance against peers in same category."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Get merchant info
    m_q = await db.execute(select(Merchant).where(Merchant.id == merchant_id))
    merchant = m_q.scalar_one_or_none()
    if not merchant:
        return {}

    category = merchant.business_category

    # Your revenue & transactions
    your_q = await db.execute(
        select(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.total_amount), 0),
        ).where(
            Transaction.merchant_id == merchant_id,
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= thirty_days_ago,
        )
    )
    your_row = your_q.one()
    your_transactions = your_row[0] or 0
    your_revenue = float(your_row[1] or 0)
    your_basket = your_revenue / your_transactions if your_transactions > 0 else 0

    # All merchants in same category
    peers_q = await db.execute(
        select(Merchant.id).where(
            Merchant.business_category == category,
            Merchant.is_active is True,
        )
    )
    peer_ids = [row[0] for row in peers_q.all()]
    total_peers = len(peer_ids)

    if total_peers == 0:
        total_peers = 1

    # Average revenue across peers
    avg_q = await db.execute(
        select(
            func.count(Transaction.id),
            func.coalesce(func.sum(Transaction.total_amount), 0),
        ).where(
            Transaction.merchant_id.in_(peer_ids),
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= thirty_days_ago,
        )
    )
    avg_row = avg_q.one()
    total_peer_tx = avg_row[0] or 0
    total_peer_revenue = float(avg_row[1] or 0)

    avg_revenue = total_peer_revenue / total_peers
    avg_transactions = total_peer_tx / total_peers
    avg_basket = total_peer_revenue / total_peer_tx if total_peer_tx > 0 else 0

    # Calculate rank percentile
    # Count merchants with lower revenue
    peer_revenues = []
    for pid in peer_ids:
        pr_q = await db.execute(
            select(func.coalesce(func.sum(Transaction.total_amount), 0)).where(
                Transaction.merchant_id == pid,
                Transaction.type == TransactionType.SALE,
                Transaction.created_at >= thirty_days_ago,
            )
        )
        peer_revenues.append(float(pr_q.scalar() or 0))

    below_count = sum(1 for r in peer_revenues if r < your_revenue)
    percentile = (below_count / total_peers) * 100 if total_peers > 0 else 50

    return {
        "your_revenue_30d": round(your_revenue, 2),
        "avg_revenue_30d": round(avg_revenue, 2),
        "your_rank_percentile": round(percentile, 1),
        "your_transactions_30d": your_transactions,
        "avg_transactions_30d": round(avg_transactions, 1),
        "your_avg_basket": round(your_basket, 2),
        "avg_basket": round(avg_basket, 2),
        "category": category.value if hasattr(category, 'value') else category,
        "total_merchants_in_category": total_peers,
    }


async def get_trending_products(db: AsyncSession, limit: int = 20) -> list[dict]:
    """Get trending products across all merchants."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    sixty_days_ago = now - timedelta(days=60)

    # Top sold products in last 30 days
    q = await db.execute(
        select(
            Product.name_fr,
            func.count(distinct(Transaction.merchant_id)).label("merchants"),
            func.sum(Transaction.quantity).label("total_sold"),
            func.avg(Transaction.unit_price).label("avg_price"),
        )
        .join(Transaction, Transaction.product_id == Product.id)
        .where(
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= thirty_days_ago,
        )
        .group_by(Product.name_fr)
        .order_by(func.sum(Transaction.quantity).desc())
        .limit(limit)
    )

    results = []
    for row in q.all():
        product_name = row[0]
        merchants_selling = row[1] or 0
        total_sold = int(row[2] or 0)
        avg_price = float(row[3] or 0)

        # Check previous period for trend
        prev_q = await db.execute(
            select(func.sum(Transaction.quantity))
            .join(Product, Product.id == Transaction.product_id)
            .where(
                Product.name_fr == product_name,
                Transaction.type == TransactionType.SALE,
                Transaction.created_at >= sixty_days_ago,
                Transaction.created_at < thirty_days_ago,
            )
        )
        prev_sold = int(prev_q.scalar() or 0)

        if prev_sold == 0:
            trend = "UP"
        elif total_sold > prev_sold * 1.1:
            trend = "UP"
        elif total_sold < prev_sold * 0.9:
            trend = "DOWN"
        else:
            trend = "STABLE"

        demand_score = min(100, (total_sold * merchants_selling) / 10)

        results.append({
            "product_name": product_name,
            "category": "GENERAL",
            "avg_price": round(avg_price, 2),
            "total_sold_30d": total_sold,
            "merchants_selling": merchants_selling,
            "price_trend": trend,
            "demand_score": round(demand_score, 1),
        })

    return results


async def get_price_benchmark(db: AsyncSession, merchant_id: str) -> list[dict]:
    """Compare merchant's prices with market averages."""
    now = datetime.now(timezone.utc)
    now - timedelta(days=30)

    # Get merchant's products
    products_q = await db.execute(
        select(Product).where(Product.merchant_id == merchant_id, Product.is_active is True)
    )
    products = products_q.scalars().all()

    results = []
    for product in products:
        # Find market prices for similar products (by name)
        market_q = await db.execute(
            select(
                func.avg(Product.unit_price),
                func.min(Product.unit_price),
                func.max(Product.unit_price),
            ).where(
                Product.name_fr == product.name_fr,
                Product.is_active is True,
            )
        )
        market_row = market_q.one()
        avg_price = float(market_row[0] or product.unit_price)
        min_price = float(market_row[1] or product.unit_price)
        max_price = float(market_row[2] or product.unit_price)

        your_price = float(product.unit_price)

        if avg_price > 0 and your_price > avg_price * 1.15:
            recommendation = "ABOVE_MARKET"
        elif avg_price > 0 and your_price < avg_price * 0.85:
            recommendation = "BELOW_MARKET"
        else:
            recommendation = "COMPETITIVE"

        results.append({
            "product_name": product.name_fr,
            "your_price": round(your_price, 2),
            "avg_market_price": round(avg_price, 2),
            "min_price": round(min_price, 2),
            "max_price": round(max_price, 2),
            "recommendation": recommendation,
        })

    return results


async def get_market_trends(db: AsyncSession, weeks: int = 8) -> list[dict]:
    """Get weekly market trends."""
    now = datetime.now(timezone.utc)
    results = []

    for i in range(weeks - 1, -1, -1):
        week_end = now - timedelta(weeks=i)
        week_start = week_end - timedelta(weeks=1)

        q = await db.execute(
            select(
                func.count(Transaction.id),
                func.coalesce(func.sum(Transaction.total_amount), 0),
            ).where(
                Transaction.type == TransactionType.SALE,
                Transaction.created_at >= week_start,
                Transaction.created_at < week_end,
            )
        )
        row = q.one()
        tx_count = row[0] or 0
        volume = float(row[1] or 0)
        avg_basket = volume / tx_count if tx_count > 0 else 0

        period = week_start.strftime("%Y-W%W")

        growth = None
        if len(results) > 0 and results[-1]["total_volume"] > 0:
            prev_vol = results[-1]["total_volume"]
            growth = round(((volume - prev_vol) / prev_vol) * 100, 1)

        results.append({
            "period": period,
            "total_volume": round(volume, 2),
            "total_transactions": tx_count,
            "avg_basket": round(avg_basket, 2),
            "growth_rate": growth,
        })

    return results
