from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PaymentCreate(BaseModel):
    order_id: Optional[str] = None
    order_type: str = "marketplace"
    method: str  # CMI, CASH_PLUS, BANK_TRANSFER, CASH
    amount: float = Field(..., gt=0)
    description: Optional[str] = None


class PaymentResponse(BaseModel):
    id: str
    merchant_id: str
    order_id: Optional[str] = None
    order_type: str
    method: str
    amount: float
    currency: str
    status: str
    external_ref: Optional[str] = None
    description: Optional[str] = None
    redirect_url: Optional[str] = None
    voucher_code: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentConfigUpdate(BaseModel):
    cmi_merchant_id: Optional[str] = None
    cmi_api_key: Optional[str] = None
    cashplus_agent_id: Optional[str] = None
    cashplus_api_key: Optional[str] = None
    preferred_method: Optional[str] = None


class PaymentConfigResponse(BaseModel):
    preferred_method: str
    has_cmi: bool = False
    has_cashplus: bool = False
    is_active: bool = True


class CMICallbackData(BaseModel):
    TransactionId: Optional[str] = None
    OrderId: Optional[str] = None
    Amount: Optional[str] = None
    Status: Optional[str] = None
    Hash: Optional[str] = None
