import re
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


def normalize_phone(phone: str) -> str:
    """Normalize phone: 0612345678 -> 212612345678, +212612345678 -> 212612345678"""
    phone = re.sub(r'[\s\-\.\(\)]', '', phone)
    phone = phone.lstrip('+')
    if phone.startswith('0') and len(phone) == 10:
        phone = '212' + phone[1:]
    return phone


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    phone = normalize_phone(req.phone_number)
    existing = await db.execute(select(Merchant).where(Merchant.phone_number == phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ce numero de telephone est deja enregistre")

    merchant = Merchant(
        phone_number=phone,
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
    phone = normalize_phone(req.phone_number)
    result = await db.execute(select(Merchant).where(Merchant.phone_number == phone))
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


@router.delete("/account", status_code=204)
async def delete_account(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete merchant account and all associated data."""
    from models.product import Product
    from models.transaction import Transaction
    from models.inventory import Inventory
    from models.conversation import Conversation

    # Delete inventory
    products = await db.execute(select(Product).where(Product.merchant_id == merchant.id))
    for p in products.scalars().all():
        if p.inventory:
            await db.delete(p.inventory)

    # Delete transactions
    txns = await db.execute(select(Transaction).where(Transaction.merchant_id == merchant.id))
    for t in txns.scalars().all():
        await db.delete(t)

    # Delete products
    products = await db.execute(select(Product).where(Product.merchant_id == merchant.id))
    for p in products.scalars().all():
        await db.delete(p)

    # Delete conversations
    convos = await db.execute(select(Conversation).where(Conversation.merchant_id == merchant.id))
    for c in convos.scalars().all():
        await db.delete(c)

    # Delete merchant
    await db.delete(merchant)
    await db.commit()
