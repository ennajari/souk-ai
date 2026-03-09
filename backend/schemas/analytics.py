from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_products: int = 0
    total_revenue_today: float = 0
    total_sales_today: int = 0
    low_stock_count: int = 0
    total_revenue_month: float = 0
    total_sales_month: int = 0


class SalesChartPoint(BaseModel):
    date: str
    revenue: float
    count: int


class ProductProfit(BaseModel):
    product_id: str
    name_fr: str
    name_ar: str
    quantity_sold: int = 0
    revenue: float = 0
    cost_total: float = 0
    profit: float = 0
    margin_pct: float = 0


class ProfitSummary(BaseModel):
    total_revenue: float = 0
    total_cost: float = 0
    total_profit: float = 0
    avg_margin: float = 0
    products: list[ProductProfit] = []
