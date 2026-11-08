from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    phone_number: str = Field(..., min_length=6, max_length=25)
    password: str = Field(..., min_length=8, max_length=128)
    business_name: str = Field(..., min_length=1, max_length=100)
    email: str | None = Field(None, max_length=255)
    preferred_language: str = Field("AR", max_length=5)
    business_category: str = "GROCERY"
    account_type: str = "MERCHANT"
    country_code: str = Field("MA", min_length=2, max_length=2)


class LoginRequest(BaseModel):
    phone_number: str = Field(..., max_length=25)
    password: str = Field(..., max_length=128)


class AdminLoginRequest(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    merchant_id: str
    business_name: str
    is_admin: bool = False
    account_type: str = "MERCHANT"
