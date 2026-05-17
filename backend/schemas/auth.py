from pydantic import BaseModel


class RegisterRequest(BaseModel):
    phone_number: str
    password: str
    business_name: str
    email: str | None = None
    preferred_language: str = "AR"
    business_category: str = "GROCERY"
    account_type: str = "MERCHANT"


class LoginRequest(BaseModel):
    phone_number: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    merchant_id: str
    business_name: str
    is_admin: bool = False
    account_type: str = "MERCHANT"
