from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import hash_password, verify_password, create_access_token
from core.deps import get_current_merchant
from models.merchant import Merchant, BusinessCategory
from schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from schemas.merchant import MerchantResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Merchant).where(Merchant.phone_number == req.phone_number))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ce numero de telephone est deja enregistre")

    merchant = Merchant(
        phone_number=req.phone_number,
        hashed_password=hash_password(req.password),
        business_name=req.business_name,
        email=req.email,
        preferred_language=req.preferred_language,
        business_category=BusinessCategory(req.business_category),
    )
    db.add(merchant)
    await db.flush()

    token = create_access_token(merchant.id)
    return TokenResponse(
        access_token=token,
        merchant_id=merchant.id,
        business_name=merchant.business_name,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Merchant).where(Merchant.phone_number == req.phone_number))
    merchant = result.scalar_one_or_none()

    if not merchant or not verify_password(req.password, merchant.hashed_password):
        raise HTTPException(status_code=401, detail="Numero ou mot de passe incorrect")

    token = create_access_token(merchant.id)
    return TokenResponse(
        access_token=token,
        merchant_id=merchant.id,
        business_name=merchant.business_name,
    )


@router.get("/me", response_model=MerchantResponse)
async def get_me(merchant: Merchant = Depends(get_current_merchant)):
    return merchant
