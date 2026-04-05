from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.payment import Payment, PaymentStatus
from schemas.payment import PaymentCreate, PaymentResponse, PaymentConfigUpdate, PaymentConfigResponse, CMICallbackData
from services.payment_service import create_payment, process_cmi_callback, get_payment_config, update_payment_config

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/", response_model=PaymentResponse)
async def initiate_payment(
    data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """Initiate a payment (CMI redirect, CashPlus voucher, or cash)."""
    valid_methods = ["CMI", "CASH_PLUS", "BANK_TRANSFER", "CASH"]
    if data.method not in valid_methods:
        raise HTTPException(400, f"Methode invalide. Valides: {valid_methods}")

    result = await create_payment(
        db=db,
        merchant_id=merchant.id,
        method=data.method,
        amount=data.amount,
        order_id=data.order_id,
        order_type=data.order_type,
        description=data.description,
    )
    return result


@router.get("/")
async def list_payments(
    status: str = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """List merchant's payments."""
    q = select(Payment).where(Payment.merchant_id == merchant.id)
    if status:
        q = q.where(Payment.status == PaymentStatus(status))
    q = q.order_by(Payment.created_at.desc()).limit(limit)

    result = await db.execute(q)
    payments = result.scalars().all()

    return [
        {
            "id": p.id,
            "order_id": p.order_id,
            "order_type": p.order_type,
            "method": p.method.value,
            "amount": float(p.amount),
            "currency": p.currency,
            "status": p.status.value,
            "external_ref": p.external_ref,
            "description": p.description,
            "created_at": p.created_at.isoformat(),
        }
        for p in payments
    ]


@router.get("/{payment_id}")
async def get_payment(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """Get payment details."""
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.merchant_id == merchant.id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Paiement introuvable")

    return {
        "id": payment.id,
        "order_id": payment.order_id,
        "order_type": payment.order_type,
        "method": payment.method.value,
        "amount": float(payment.amount),
        "currency": payment.currency,
        "status": payment.status.value,
        "external_ref": payment.external_ref,
        "gateway_response": payment.gateway_response,
        "description": payment.description,
        "created_at": payment.created_at.isoformat(),
    }


# ─── Payment Config ───

@router.get("/config/me", response_model=PaymentConfigResponse)
async def my_payment_config(
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """Get my payment configuration."""
    return await get_payment_config(db, merchant.id)


@router.patch("/config/me", response_model=PaymentConfigResponse)
async def update_my_payment_config(
    data: PaymentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """Update my payment configuration."""
    return await update_payment_config(db, merchant.id, data.model_dump(exclude_unset=True))


# ─── CMI Callback (public, no auth) ───

@router.post("/callback/cmi")
async def cmi_callback(
    data: CMICallbackData,
    db: AsyncSession = Depends(get_db),
):
    """CMI payment gateway callback (called by CMI servers)."""
    payment = await process_cmi_callback(db, data.model_dump())
    if not payment:
        raise HTTPException(400, "Payment not found")
    return {"status": "ok", "payment_status": payment.status.value}
