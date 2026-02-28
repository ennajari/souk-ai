from pydantic import BaseModel


class RegisterRequest(BaseModel):
    phone_number: str
    password: str
    business_name: str
    email: str | None = None
    preferred_language: str = "AR"
    business_category: str = "GROCERY"


class LoginRequest(BaseModel):
    phone_number: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    merchant_id: str
    business_name: str
