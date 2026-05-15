from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from schemas.invoice import InvoiceCreate, InvoiceResponse, InvoicePayRequest
from services.invoice_service import (
    create_invoice, get_invoice, get_invoice_by_token,
    list_invoices, pay_invoice, cancel_invoice,
)
from app.config import settings

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _invoice_to_response(inv, include_payment_url: bool = True) -> dict:
    data = {
        "id": inv.id,
        "merchant_id": inv.merchant_id,
        "customer_name": inv.customer_name,
        "customer_phone": inv.customer_phone,
        "items": inv.items,
        "total_amount": float(inv.total_amount),
        "currency": inv.currency,
        "status": inv.status.value,
        "payment_method": inv.payment_method.value if inv.payment_method else None,
        "payment_ref": inv.payment_ref,
        "token": inv.token,
        "notes": inv.notes,
        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
        "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
        "created_at": inv.created_at.isoformat(),
        "payment_url": None,
    }
    if include_payment_url and inv.status.value == "PENDING":
        data["payment_url"] = f"{settings.FRONTEND_URL}/pay/{inv.token}"
    return data


@router.post("/", response_model=InvoiceResponse)
async def create_new_invoice(
    data: InvoiceCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Create an invoice/ticket for client payment."""
    if not data.items:
        raise HTTPException(400, "Au moins un article requis")

    items = [i.model_dump() for i in data.items]
    invoice = await create_invoice(
        db=db,
        merchant_id=merchant.id,
        items=items,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        notes=data.notes,
        expires_minutes=data.expires_minutes,
    )
    await db.commit()
    return _invoice_to_response(invoice)


@router.get("/")
async def list_merchant_invoices(
    status: str = None,
    limit: int = 50,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    merchant: Annotated[Merchant, Depends(get_current_merchant)] = None,
):
    """List merchant's invoices."""
    invoices = await list_invoices(db, merchant.id, status=status, limit=limit)
    return [_invoice_to_response(inv) for inv in invoices]


@router.get("/{invoice_id}")
async def get_merchant_invoice(
    invoice_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Get invoice details."""
    invoice = await get_invoice(db, invoice_id, merchant.id)
    if not invoice:
        raise HTTPException(404, "Facture introuvable")
    return _invoice_to_response(invoice)


@router.delete("/{invoice_id}")
async def cancel_merchant_invoice(
    invoice_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Cancel a pending invoice."""
    invoice = await get_invoice(db, invoice_id, merchant.id)
    if not invoice:
        raise HTTPException(404, "Facture introuvable")
    if not await cancel_invoice(db, invoice):
        raise HTTPException(400, "Impossible d'annuler cette facture")
    await db.commit()
    return {"status": "cancelled"}


# --- Public endpoints (no auth — client-facing) ---

@router.get("/pay/{token}")
async def get_invoice_for_payment(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get invoice details by token (public, for client payment page)."""
    invoice = await get_invoice_by_token(db, token)
    if not invoice:
        raise HTTPException(404, "Facture introuvable")
    return _invoice_to_response(invoice, include_payment_url=False)


@router.post("/pay/{token}")
async def process_invoice_payment(
    token: str,
    data: InvoicePayRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Pay an invoice (public endpoint for NFC/card/cash payment)."""
    invoice = await get_invoice_by_token(db, token)
    if not invoice:
        raise HTTPException(404, "Facture introuvable")

    result = await pay_invoice(
        db=db,
        invoice=invoice,
        method=data.method,
        card_number=data.card_number,
        pin=data.pin,
        nfc_uid=data.nfc_uid,
    )

    if not result["success"]:
        raise HTTPException(400, result["error"])

    await db.commit()
    return result
