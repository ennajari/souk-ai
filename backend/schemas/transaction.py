from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

TxType = Literal["SALE", "PURCHASE", "ADJUSTMENT", "RETURN"]
TxSource = Literal["WHATSAPP", "VOICE", "WEB", "API"]


class TransactionCreate(BaseModel):
    product_id: str = Field(..., max_length=36)
    customer_id: str | None = Field(None, max_length=36)
    type: TxType = "SALE"
    source: TxSource = "WEB"
    quantity: int = Field(..., gt=0, le=100_000)  # a negative "sale" used to add stock (AUDIT L1)
    unit_price: Decimal = Field(..., ge=0, le=10_000_000)


class BulkTransactionCreate(BaseModel):
    """One POS checkout: items + how it is paid, applied in a single DB transaction."""
    items: list[TransactionCreate] = Field(..., min_length=1, max_length=500)
    customer_id: str | None = Field(None, max_length=36)
    payment_method: Literal["CASH", "CREDIT", "NFC_SOUKCARD", "NFC_BANK"] = "CASH"
    card_number: str | None = Field(None, max_length=16)
    nfc_uid: str | None = Field(None, max_length=32)
    pin: str | None = Field(None, max_length=6)


class TransactionResponse(BaseModel):
    id: str
    merchant_id: str
    product_id: str
    customer_id: str | None = None
    product_name_ar: str | None = None
    product_name_fr: str | None = None
    type: str
    source: str
    quantity: int
    unit_price: float
    total_amount: float
    created_at: datetime

    model_config = {"from_attributes": True}
