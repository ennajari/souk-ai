from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from services.market_intelligence import (
    get_market_overview,
    get_merchant_benchmark,
    get_trending_products,
    get_price_benchmark,
    get_market_trends,
)

router = APIRouter(prefix="/market", tags=["market-intelligence"])


@router.get("/overview")
async def market_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Get overall market overview."""
    return await get_market_overview(db)


@router.get("/benchmark")
async def my_benchmark(
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Get your performance compared to peers in the same category."""
    return await get_merchant_benchmark(db, merchant.id)


@router.get("/trending-products")
async def trending_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    limit: int = Query(20, ge=1, le=50),
):
    """Get trending products across the marketplace."""
    return await get_trending_products(db, limit)


@router.get("/price-benchmark")
async def price_benchmark(
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Compare your prices with market averages."""
    return await get_price_benchmark(db, merchant.id)


@router.get("/trends")
async def market_trends(
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    weeks: int = Query(8, ge=1, le=52),
):
    """Get weekly market trends."""
    return await get_market_trends(db, weeks)
