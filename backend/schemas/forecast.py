from pydantic import BaseModel
from datetime import date


class ForecastPoint(BaseModel):
    date: date
    demand: float
    lower: float
    upper: float
    factors: dict | None = None


class ProductForecast(BaseModel):
    product_id: str
    product_name_ar: str
    product_name_fr: str
    current_stock: float
    predicted_demand_7d: float
    restock_quantity: int
    forecast: list[ForecastPoint]
