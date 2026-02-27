from pydantic import BaseModel
from datetime import datetime


class MerchantResponse(BaseModel):
    id: str
    phone_number: str
    business_name: str
    email: str | None = None
    preferred_language: str
    business_category: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class MerchantUpdate(BaseModel):
    business_name: str | None = None
    email: str | None = None
    preferred_language: str | None = None
    business_category: str | None = None
