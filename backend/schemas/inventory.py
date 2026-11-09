from pydantic import BaseModel, Field
from datetime import datetime


class InventoryResponse(BaseModel):
    id: str
    product_id: str
    product_name_ar: str | None = None
    product_name_fr: str | None = None
    quantity: float
    reorder_threshold: int
    unit: str | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class InventoryAdjust(BaseModel):
    product_id: str = Field(..., max_length=36)
    quantity_change: float = Field(..., ge=-1_000_000, le=1_000_000)
    reason: str = Field("", max_length=255)


class ThresholdUpdate(BaseModel):
    reorder_threshold: int = Field(..., ge=0, le=1_000_000)
