from pydantic import BaseModel
from datetime import datetime


class ProductCreate(BaseModel):
    name_ar: str
    name_fr: str
    barcode: str | None = None
    unit: str = "piece"
    unit_price: float = 0
    cost_price: float = 0


class ProductUpdate(BaseModel):
    name_ar: str | None = None
    name_fr: str | None = None
    barcode: str | None = None
    unit: str | None = None
    unit_price: float | None = None
    cost_price: float | None = None


class ProductResponse(BaseModel):
    id: str
    merchant_id: str
    name_ar: str
    name_fr: str
    barcode: str | None
    unit: str
    unit_price: float
    cost_price: float
    is_active: bool
    created_at: datetime
    stock_quantity: float | None = None

    model_config = {"from_attributes": True}
