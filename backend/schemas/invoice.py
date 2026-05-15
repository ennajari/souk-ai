from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class InvoiceItemSchema(BaseModel):
    product_name: str
    quantity: float = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)


class InvoiceCreate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: list[InvoiceItemSchema]
    notes: Optional[str] = None
    expires_minutes: int = Field(default=60, ge=5, le=1440)


class InvoiceResponse(BaseModel):
    id: str
    merchant_id: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: list[dict]
    total_amount: float
    currency: str
    status: str
    payment_method: Optional[str] = None
    payment_ref: Optional[str] = None
    token: str
    notes: Optional[str] = None
    paid_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    payment_url: Optional[str] = None

    class Config:
        from_attributes = True


class InvoicePayRequest(BaseModel):
    method: str  # NFC_BANK, NFC_SOUKCARD, CASH, CMI
    card_number: Optional[str] = None
    pin: Optional[str] = None
    nfc_uid: Optional[str] = None
