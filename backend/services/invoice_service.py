"""Invoice service — create tickets, process NFC/card payments."""
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.invoice import Invoice, InvoiceStatus, InvoicePaymentMethod
from models.payment import Payment, PaymentMethod, PaymentStatus
from services.soukcard_service import pay_with_soukcard
from app.config import settings

logger = logging.getLogger("souk_ai")


async def create_invoice(
    db: AsyncSession,
    merchant_id: str,
    items: list[dict],
    customer_name: str | None = None,
    customer_phone: str | None = None,
    notes: str | None = None,
    expires_minutes: int = 60,
) -> Invoice:
    total = sum(i["quantity"] * i["unit_price"] for i in items)
    invoice = Invoice(
        merchant_id=merchant_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        items=[
            {"product_name": i["product_name"], "quantity": i["quantity"], "unit_price": i["unit_price"]}
            for i in items
        ],
        total_amount=total,
        notes=notes,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=expires_minutes),
    )
    db.add(invoice)
    await db.flush()
    return invoice


async def get_invoice_by_token(db: AsyncSession, token: str, for_update: bool = False) -> Invoice | None:
    q = select(Invoice).where(Invoice.token == token)
    # Row lock serializes concurrent pay attempts on the same invoice (no double debit)
    result = await db.execute(q.with_for_update().execution_options(populate_existing=True) if for_update else q)
    return result.scalar_one_or_none()


async def get_invoice(db: AsyncSession, invoice_id: str, merchant_id: str) -> Invoice | None:
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.merchant_id == merchant_id)
    )
    return result.scalar_one_or_none()


async def list_invoices(db: AsyncSession, merchant_id: str, status: str | None = None, limit: int = 50) -> list[Invoice]:
    q = select(Invoice).where(Invoice.merchant_id == merchant_id)
    if status:
        q = q.where(Invoice.status == InvoiceStatus(status))
    q = q.order_by(Invoice.created_at.desc()).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


async def pay_invoice(
    db: AsyncSession,
    invoice: Invoice,
    method: str,
    card_number: str | None = None,
    pin: str | None = None,
    nfc_uid: str | None = None,
) -> dict:
    if invoice.status != InvoiceStatus.PENDING:
        return {"success": False, "error": "Facture deja traitee"}

    if invoice.expires_at and datetime.now(timezone.utc) > invoice.expires_at:
        invoice.status = InvoiceStatus.EXPIRED
        await db.flush()
        return {"success": False, "error": "Facture expiree"}

    if method == "NFC_SOUKCARD":
        if not card_number and not nfc_uid:
            return {"success": False, "error": "Carte Souk.AI requise"}
        result = await pay_with_soukcard(
            db=db,
            card_number=card_number,
            nfc_uid=nfc_uid,
            pin=pin,
            amount=float(invoice.total_amount),
            merchant_id=invoice.merchant_id,
            reference=f"INV-{invoice.id[:8].upper()}",
        )
        if not result["success"]:
            return result

        invoice.status = InvoiceStatus.PAID
        invoice.payment_method = InvoicePaymentMethod.NFC_SOUKCARD
        invoice.payment_ref = result["transaction_id"]
        invoice.paid_at = datetime.now(timezone.utc)

    elif method == "NFC_BANK":
        invoice.status = InvoiceStatus.PAID
        invoice.payment_method = InvoicePaymentMethod.NFC_BANK
        invoice.payment_ref = f"NFC-{invoice.id[:8].upper()}"
        invoice.paid_at = datetime.now(timezone.utc)

    elif method == "CMI":
        invoice.payment_method = InvoicePaymentMethod.CMI
        cmi_base = getattr(settings, "CMI_GATEWAY_URL", "https://payment.cmi.co.ma/fim/est3Dgate")
        redirect_url = (
            f"{cmi_base}?clientid=souk_ai&amount={invoice.total_amount}"
            f"&oid={invoice.id}&currency=504"
            f"&okUrl={settings.FRONTEND_URL}/payments/invoice/{invoice.token}/success"
            f"&failUrl={settings.FRONTEND_URL}/payments/invoice/{invoice.token}/fail"
        )
        await db.flush()
        return {"success": True, "redirect_url": redirect_url}

    elif method == "CASH":
        invoice.status = InvoiceStatus.PAID
        invoice.payment_method = InvoicePaymentMethod.CASH
        invoice.payment_ref = f"CASH-{invoice.id[:8].upper()}"
        invoice.paid_at = datetime.now(timezone.utc)

    else:
        return {"success": False, "error": f"Methode invalide: {method}"}

    payment = Payment(
        merchant_id=invoice.merchant_id,
        order_id=invoice.id,
        order_type="invoice",
        method=PaymentMethod(method),
        amount=float(invoice.total_amount),
        status=PaymentStatus.COMPLETED,
        external_ref=invoice.payment_ref,
        description=f"Paiement facture {invoice.id[:8].upper()}",
    )
    db.add(payment)
    await db.flush()

    logger.info(f"Invoice {invoice.id[:8]} paid via {method} — {invoice.total_amount} MAD")
    return {"success": True, "payment_id": payment.id, "payment_ref": invoice.payment_ref}


async def cancel_invoice(db: AsyncSession, invoice: Invoice) -> bool:
    if invoice.status != InvoiceStatus.PENDING:
        return False
    invoice.status = InvoiceStatus.CANCELLED
    await db.flush()
    return True
