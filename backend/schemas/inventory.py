from pydantic import BaseModel
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
    product_id: str
    quantity_change: float
    reason: str = ""


class ThresholdUpdate(BaseModel):
    reorder_threshold: int
