from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ListingCreate(BaseModel):
    product_id: Optional[str] = None
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    category: str = "OTHER"
    unit_price: float = Field(..., gt=0)
    min_quantity: int = Field(1, ge=1)
    available_quantity: int = Field(..., ge=0)
    unit: str = "piece"
    city: Optional[str] = None
    delivery_zones: Optional[list[str]] = None


class ListingUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    unit_price: Optional[float] = Field(None, gt=0)
    min_quantity: Optional[int] = Field(None, ge=1)
    available_quantity: Optional[int] = Field(None, ge=0)
    city: Optional[str] = None
    delivery_zones: Optional[list[str]] = None
    status: Optional[str] = None


class ListingResponse(BaseModel):
    id: str
    merchant_id: str
    product_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    category: str
    unit_price: float
    min_quantity: int
    available_quantity: int
    unit: str
    city: Optional[str] = None
    delivery_zones: Optional[list[str]] = None
    status: str
    is_featured: bool
    views_count: int
    seller_name: Optional[str] = None
    seller_rating: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MarketplaceOrderCreate(BaseModel):
    listing_id: str
    quantity: int = Field(..., ge=1)
    delivery_address: Optional[str] = None
    notes: Optional[str] = None


class MarketplaceOrderResponse(BaseModel):
    id: str
    listing_id: str
    buyer_id: str
    seller_id: str
    quantity: int
    unit_price: float
    total_amount: float
    status: str
    delivery_address: Optional[str] = None
    notes: Optional[str] = None
    payment_id: Optional[str] = None
    listing_title: Optional[str] = None
    buyer_name: Optional[str] = None
    seller_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OrderStatusUpdate(BaseModel):
    status: str
