from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from schemas.souk_card import (
    SoukCardRegister, SoukCardResponse, SoukCardTopUp,
    SoukCardBalanceResponse,
)
from services.soukcard_service import (
    register_card, get_card, get_card_by_phone, get_card_by_nfc,
    top_up_card, get_card_transactions,
)

router = APIRouter(prefix="/souk-cards", tags=["souk-cards"])


@router.post("/register", response_model=SoukCardResponse)
async def register_souk_card(
    data: SoukCardRegister,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Register a new Carte Souk.AI (merchant creates card for client/supplier)."""
    try:
        card = await register_card(
            db=db,
            holder_name=data.holder_name,
            holder_phone=data.holder_phone,
            pin=data.pin,
            nfc_uid=data.nfc_uid,
            card_type=data.card_type,
            card_number=data.card_number,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    await db.commit()
    return {
        "id": card.id,
        "card_number": card.card_number,
        "holder_name": card.holder_name,
        "holder_phone": card.holder_phone,
        "balance": float(card.balance),
        "status": card.status.value,
        "card_type": card.card_type.value,
        "nfc_uid": card.nfc_uid,
        "created_at": card.created_at,
    }


@router.post("/topup")
async def topup_souk_card(
    data: SoukCardTopUp,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Top up a Carte Souk.AI (requires authentication)."""
    result = await top_up_card(
        db=db,
        card_number=data.card_number,
        amount=data.amount,
        bank_reference=data.bank_reference,
        merchant_id=merchant.id,
    )
    if not result["success"]:
        raise HTTPException(400, result["error"])
    await db.commit()
    return result


# Static path routes BEFORE dynamic /{card_number} to avoid conflicts

@router.get("/nfc/{nfc_uid}")
async def card_by_nfc(
    nfc_uid: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Find a card by its NFC UID (used during contactless payment)."""
    card = await get_card_by_nfc(db, nfc_uid)
    if not card:
        raise HTTPException(404, "Carte NFC non reconnue")
    return {
        "card_number": card.card_number,
        "holder_name": card.holder_name,
        "balance": float(card.balance),
        "status": card.status.value,
        "card_type": card.card_type.value if card.card_type else "CLIENT",
    }


@router.get("/phone/{phone}")
async def cards_by_phone(
    phone: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Find all active cards for a phone number."""
    cards = await get_card_by_phone(db, phone)
    return [
        {
            "card_number": c.card_number,
            "holder_name": c.holder_name,
            "balance": float(c.balance),
            "status": c.status.value,
            "card_type": c.card_type.value if c.card_type else "CLIENT",
        }
        for c in cards
    ]


# Dynamic path routes last

@router.get("/{card_number}", response_model=SoukCardBalanceResponse)
async def check_balance(
    card_number: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Check Carte Souk.AI balance (public)."""
    card = await get_card(db, card_number)
    if not card:
        raise HTTPException(404, "Carte introuvable")
    return {
        "card_number": card.card_number,
        "holder_name": card.holder_name,
        "balance": float(card.balance),
        "status": card.status.value,
        "card_type": card.card_type.value if card.card_type else "CLIENT",
    }


@router.get("/{card_number}/transactions")
async def card_transaction_history(
    card_number: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    limit: int = Query(50, le=200),
):
    """Get transaction history for a Carte Souk.AI."""
    card = await get_card(db, card_number)
    if not card:
        raise HTTPException(404, "Carte introuvable")
    txns = await get_card_transactions(db, card.id, limit=limit)
    return [
        {
            "id": t.id,
            "type": t.type.value,
            "amount": float(t.amount),
            "balance_after": float(t.balance_after),
            "reference": t.reference,
            "description": t.description,
            "created_at": t.created_at.isoformat(),
        }
        for t in txns
    ]
