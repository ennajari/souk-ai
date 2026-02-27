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
