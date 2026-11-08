from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field
from datetime import datetime


class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    notes: str | None = None
    credit_limit: float = Field(default=0, ge=0)  # 0 = no limit
    whatsapp_opt_in: bool = False


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    notes: str | None = None
    credit_limit: float | None = Field(default=None, ge=0)
    whatsapp_opt_in: bool | None = None


class CreditEntryCreate(BaseModel):
    type: Literal["CREDIT", "PAYMENT"]
    amount: Decimal = Field(gt=0, le=10_000_000)
    description: str | None = Field(None, max_length=255)


class CreditEntryResponse(BaseModel):
    id: str
    customer_id: str
    type: str
    amount: float
    description: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerResponse(BaseModel):
    id: str
    merchant_id: str
    name: str
    phone: str | None = None
    notes: str | None = None
    balance: float = 0
    credit_limit: float = 0
    whatsapp_opt_in: bool = False
    is_active: bool = True
    created_at: datetime
    entries: list[CreditEntryResponse] = []

    model_config = {"from_attributes": True}


class CustomerListResponse(BaseModel):
    id: str
    name: str
    phone: str | None = None
    balance: float = 0
    credit_limit: float = 0
    whatsapp_opt_in: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
