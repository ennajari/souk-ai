from pydantic import BaseModel
from datetime import datetime


class TransactionCreate(BaseModel):
    product_id: str
    customer_id: str | None = None
    type: str = "SALE"
    source: str = "WEB"
    quantity: int
    unit_price: float


class TransactionResponse(BaseModel):
    id: str
    merchant_id: str
    product_id: str
    product_name_ar: str | None = None
    product_name_fr: str | None = None
    type: str
    source: str
    quantity: int
    unit_price: float
    total_amount: float
    created_at: datetime

    model_config = {"from_attributes": True}
