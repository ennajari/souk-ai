from pydantic import BaseModel
from typing import Optional


class MarketOverview(BaseModel):
    total_merchants: int
    total_products: int
    total_transactions_30d: int
    total_volume_30d: float
    avg_basket_size: float
    top_categories: list[dict]
    active_cities: list[str]


class MerchantBenchmark(BaseModel):
    your_revenue_30d: float
    avg_revenue_30d: float
    your_rank_percentile: float  # 0-100
    your_transactions_30d: int
    avg_transactions_30d: float
    your_avg_basket: float
    avg_basket: float
    category: str
    total_merchants_in_category: int


class TrendingProduct(BaseModel):
    product_name: str
    category: str
    avg_price: float
    total_sold_30d: int
    merchants_selling: int
    price_trend: str  # UP, DOWN, STABLE
    demand_score: float


class PriceBenchmark(BaseModel):
    product_name: str
    your_price: float
    avg_market_price: float
    min_price: float
    max_price: float
    recommendation: str  # COMPETITIVE, ABOVE_MARKET, BELOW_MARKET


class MarketTrend(BaseModel):
    period: str
    total_volume: float
    total_transactions: int
    avg_basket: float
    growth_rate: Optional[float] = None
