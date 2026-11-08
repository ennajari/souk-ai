from pydantic import BaseModel, Field
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
    country_code: str = "MA"
    currency: str = "MAD"
    timezone: str = "Africa/Casablanca"
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MerchantUpdate(BaseModel):
    # Whitelist only: security-relevant fields (is_admin, phone, token_version) are never settable here
    business_name: str | None = None
    owner_name: str | None = None
    email: str | None = None
    preferred_language: str | None = None
    business_category: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    currency: str | None = Field(None, min_length=3, max_length=3)
    timezone: str | None = Field(None, max_length=64)
