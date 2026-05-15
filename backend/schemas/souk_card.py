from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SoukCardRegister(BaseModel):
    holder_name: str = Field(..., min_length=2, max_length=100)
    holder_phone: str = Field(..., pattern=r"^212\d{9}$")
    pin: str = Field(..., min_length=4, max_length=6, pattern=r"^\d{4,6}$")
    nfc_uid: Optional[str] = None


class SoukCardResponse(BaseModel):
    id: str
    card_number: str
    holder_name: str
    holder_phone: str
    balance: float
    status: str
    nfc_uid: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SoukCardTopUp(BaseModel):
    card_number: str
    amount: float = Field(..., gt=0, le=5000)
    bank_reference: Optional[str] = None


class SoukCardBalanceResponse(BaseModel):
    card_number: str
    holder_name: str
    balance: float
    status: str


class CardTransactionResponse(BaseModel):
    id: str
    type: str
    amount: float
    balance_after: float
    reference: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
