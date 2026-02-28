from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from models.supplier import SupplierCategory


class SupplierCreate(BaseModel):
    name: str
    category: SupplierCategory = SupplierCategory.FMCG
    contact_name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    minimum_order_value: float = 0.0
    product_ids: Optional[List[str]] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[SupplierCategory] = None
    contact_name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    minimum_order_value: Optional[float] = None
    product_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None


class SupplierResponse(BaseModel):
    id: str
    name: str
    category: SupplierCategory
    contact_name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    minimum_order_value: float
    product_ids: Optional[List[str]] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SupplierOrderCreate(BaseModel):
    product_id: str
    quantity: int
    note: Optional[str] = None


class SupplierOrderResponse(BaseModel):
    id: str
    supplier_id: str
    merchant_id: Optional[str] = None
    status: str
    total_amount: float
    items: list
    created_at: datetime

    model_config = {"from_attributes": True}
