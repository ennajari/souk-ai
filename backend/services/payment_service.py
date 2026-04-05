"""Payment service for CMI and CashPlus integration (Morocco)."""
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.payment import Payment, PaymentMethod, PaymentStatus, MerchantPaymentConfig
from app.config import settings


async def create_payment(
    db: AsyncSession,
    merchant_id: str,
    method: str,
    amount: float,
    order_id: str | None = None,
    order_type: str = "marketplace",
    description: str | None = None,
) -> dict:
    """Create a payment and return payment info with redirect/voucher details."""
    payment = Payment(
        merchant_id=merchant_id,
        order_id=order_id,
        order_type=order_type,
        method=PaymentMethod(method),
        amount=amount,
        description=description,
    )
    db.add(payment)
    await db.flush()

    result = {
        "id": payment.id,
        "merchant_id": merchant_id,
        "order_id": order_id,
        "order_type": order_type,
        "method": method,
        "amount": amount,
        "currency": "MAD",
        "status": payment.status.value,
        "external_ref": None,
        "description": description,
        "redirect_url": None,
        "voucher_code": None,
        "created_at": payment.created_at,
    }

    if method == "CMI":
        result["redirect_url"] = _generate_cmi_redirect(payment)
        result["external_ref"] = f"CMI-{payment.id[:8].upper()}"
        payment.external_ref = result["external_ref"]
    elif method == "CASH_PLUS":
        voucher = _generate_cashplus_voucher(payment)
        result["voucher_code"] = voucher
        result["external_ref"] = f"CP-{payment.id[:8].upper()}"
        payment.external_ref = result["external_ref"]
    elif method == "BANK_TRANSFER":
        result["external_ref"] = f"VIR-{payment.id[:8].upper()}"
        payment.external_ref = result["external_ref"]
    elif method == "CASH":
        payment.status = PaymentStatus.COMPLETED
        result["status"] = "COMPLETED"

    await db.flush()
    return result


def _generate_cmi_redirect(payment: Payment) -> str:
    """Generate CMI payment gateway redirect URL.

    In production, this would create a signed request to CMI's payment page.
    For now, returns a simulated redirect URL.
    """
    cmi_base = getattr(settings, "CMI_GATEWAY_URL", "https://payment.cmi.co.ma/fim/est3Dgate")
    return (
        f"{cmi_base}?"
        f"clientid=souk_ai&"
        f"amount={payment.amount}&"
        f"oid={payment.id}&"
        f"currency=504&"
        f"okUrl={settings.FRONTEND_URL}/payments/success&"
        f"failUrl={settings.FRONTEND_URL}/payments/fail"
    )


def _generate_cashplus_voucher(payment: Payment) -> str:
    """Generate a CashPlus payment voucher code.

    In production, this calls CashPlus API to create a payment voucher.
    The merchant shows this code at any CashPlus agent to pay.
    """
    return f"CP{payment.id[:8].upper()}{int(payment.amount):06d}"


async def process_cmi_callback(db: AsyncSession, data: dict) -> Payment | None:
    """Process CMI payment gateway callback."""
    order_id = data.get("OrderId")
    status = data.get("Status")

    if not order_id:
        return None

    result = await db.execute(select(Payment).where(Payment.id == order_id))
    payment = result.scalar_one_or_none()
    if not payment:
        return None

    payment.gateway_response = data
    if status == "APPROVED":
        payment.status = PaymentStatus.COMPLETED
    else:
        payment.status = PaymentStatus.FAILED
    payment.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return payment


async def get_payment_config(db: AsyncSession, merchant_id: str) -> dict:
    """Get merchant's payment configuration."""
    result = await db.execute(
        select(MerchantPaymentConfig).where(MerchantPaymentConfig.merchant_id == merchant_id)
    )
    config = result.scalar_one_or_none()
    if not config:
        return {
            "preferred_method": "CASH",
            "has_cmi": False,
            "has_cashplus": False,
            "is_active": True,
        }
    return {
        "preferred_method": config.preferred_method.value,
        "has_cmi": bool(config.cmi_merchant_id and config.cmi_api_key),
        "has_cashplus": bool(config.cashplus_agent_id and config.cashplus_api_key),
        "is_active": config.is_active,
    }


async def update_payment_config(db: AsyncSession, merchant_id: str, data: dict) -> dict:
    """Update merchant's payment configuration."""
    result = await db.execute(
        select(MerchantPaymentConfig).where(MerchantPaymentConfig.merchant_id == merchant_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        config = MerchantPaymentConfig(merchant_id=merchant_id)
        db.add(config)

    for key, value in data.items():
        if value is not None and hasattr(config, key):
            if key == "preferred_method":
                setattr(config, key, PaymentMethod(value))
            else:
                setattr(config, key, value)

    await db.flush()
    return await get_payment_config(db, merchant_id)
