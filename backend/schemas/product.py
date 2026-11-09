from pydantic import BaseModel, Field
from datetime import datetime, date


class ProductCreate(BaseModel):
    name_ar: str
    name_fr: str
    barcode: str | None = None
    unit: str = "piece"
    unit_price: float = 0
    cost_price: float = 0
    tax_rate: float | None = Field(None, ge=0, le=100)
    manufacture_date: date | None = None
    expiry_date: date | None = None
    initial_stock: float = 0  # Used on creation to pre-fill inventory


class ProductUpdate(BaseModel):
    name_ar: str | None = None
    name_fr: str | None = None
    barcode: str | None = None
    unit: str | None = None
    unit_price: float | None = None
    cost_price: float | None = None
    tax_rate: float | None = Field(None, ge=0, le=100)
    manufacture_date: date | None = None
    expiry_date: date | None = None


class ProductResponse(BaseModel):
    id: str
    merchant_id: str
    name_ar: str
    name_fr: str
    barcode: str | None
    unit: str
    unit_price: float
    cost_price: float
    tax_rate: float | None = None
    is_active: bool
    created_at: datetime
    manufacture_date: date | None = None
    expiry_date: date | None = None
    stock_quantity: float | None = None

    model_config = {"from_attributes": True}
