from pydantic import BaseModel
from datetime import datetime


class MerchantResponse(BaseModel):
    id: str
    phone_number: str
    business_name: str
    owner_name: str | None = None
    email: str | None = None
    preferred_language: str
    business_category: str
    location_lat: float | None = None
    location_lng: float | None = None
    account_type: str = "MERCHANT"
    credit_score: int = 500
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MerchantUpdate(BaseModel):
    business_name: str | None = None
    owner_name: str | None = None
    email: str | None = None
    preferred_language: str | None = None
    business_category: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
