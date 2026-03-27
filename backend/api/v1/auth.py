import re
import random
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from core.database import get_db
from core.security import hash_password, verify_password, create_access_token
from core.deps import get_current_merchant
from models.merchant import Merchant, BusinessCategory
from schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from schemas.merchant import MerchantResponse

router = APIRouter(prefix="/auth", tags=["auth"])


class ResetRequestBody(BaseModel):
    phone_number: str


class ResetConfirmBody(BaseModel):
    phone_number: str
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)


def normalize_phone(phone: str) -> str:
    """Normalize phone: 0612345678 -> 212612345678, +212612345678 -> 212612345678"""
    phone = re.sub(r'[\s\-\.\(\)]', '', phone)
    phone = phone.lstrip('+')
    if phone.startswith('0') and len(phone) == 10:
        phone = '212' + phone[1:]
    return phone


async def _get_redis():
    """Get async Redis connection for OTP storage."""
    import redis.asyncio as aioredis
    from app.config import settings
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


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


@router.post("/reset-request")
async def reset_request(body: ResetRequestBody, db: AsyncSession = Depends(get_db)):
    """Send a 6-digit OTP to the merchant's WhatsApp number."""
    phone = normalize_phone(body.phone_number)
    result = await db.execute(select(Merchant).where(Merchant.phone_number == phone))
    merchant = result.scalar_one_or_none()
    if not merchant:
        raise HTTPException(404, "Aucun compte avec ce numero")

    code = str(random.randint(100000, 999999))

    # Store OTP in Redis with 10 min expiry (works across multiple workers)
    r = await _get_redis()
    await r.setex(f"otp:{phone}", 600, code)
    await r.aclose()

    from services.whatsapp import send_text_message
    await send_text_message(phone, f"Souk.AI - Code de reinitialisation: {code}\nCe code expire dans 10 minutes.")

    return {"message": "Code envoye par WhatsApp"}


@router.post("/reset-confirm", response_model=TokenResponse)
async def reset_confirm(body: ResetConfirmBody, db: AsyncSession = Depends(get_db)):
    """Verify OTP code and set new password."""
    phone = normalize_phone(body.phone_number)

    r = await _get_redis()
    stored_code = await r.get(f"otp:{phone}")

    if not stored_code:
        await r.aclose()
        raise HTTPException(400, "Aucun code demande ou code expire")
    if stored_code != body.code:
        await r.aclose()
        raise HTTPException(400, "Code incorrect")

    # Code valid — delete OTP
    await r.delete(f"otp:{phone}")
    await r.aclose()

    result = await db.execute(select(Merchant).where(Merchant.phone_number == phone))
    merchant = result.scalar_one_or_none()
    if not merchant:
        raise HTTPException(404, "Compte introuvable")

    merchant.hashed_password = hash_password(body.new_password)
    await db.flush()

    token = create_access_token(merchant.id)
    return TokenResponse(
        access_token=token,
        merchant_id=merchant.id,
        business_name=merchant.business_name,
    )


@router.delete("/account", status_code=204)
async def delete_account(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete merchant account and all associated data."""
    from models.product import Product
    from models.transaction import Transaction
    from models.inventory import Inventory
    from models.conversation import ConversationMessage as Conversation
    from models.customer import Customer, CreditEntry
    from models.notification import Notification
    from models.employee import Employee
    from models.forecast import Forecast
    from models.credit import CreditHistory
    from models.order import Order
    from models.supplier_order import SupplierOrder

    mid = merchant.id

    # Delete credit entries (FK to customers)
    customers_q = await db.execute(select(Customer.id).where(Customer.merchant_id == mid))
    customer_ids = [c for c in customers_q.scalars().all()]
    if customer_ids:
        await db.execute(delete(CreditEntry).where(CreditEntry.customer_id.in_(customer_ids)))

    # Delete inventory (FK to products)
    products_q = await db.execute(select(Product.id).where(Product.merchant_id == mid))
    product_ids = [p for p in products_q.scalars().all()]
    if product_ids:
        await db.execute(delete(Inventory).where(Inventory.product_id.in_(product_ids)))

    # Delete all merchant-owned records
    await db.execute(delete(Transaction).where(Transaction.merchant_id == mid))
    await db.execute(delete(SupplierOrder).where(SupplierOrder.merchant_id == mid))
    await db.execute(delete(Order).where(Order.merchant_id == mid))
    await db.execute(delete(Product).where(Product.merchant_id == mid))
    await db.execute(delete(Customer).where(Customer.merchant_id == mid))
    await db.execute(delete(Notification).where(Notification.merchant_id == mid))
    await db.execute(delete(Employee).where(Employee.merchant_id == mid))
    await db.execute(delete(Forecast).where(Forecast.merchant_id == mid))
    await db.execute(delete(CreditHistory).where(CreditHistory.merchant_id == mid))
    await db.execute(delete(Conversation).where(Conversation.merchant_id == mid))

    # Delete merchant
    await db.delete(merchant)
    await db.flush()
