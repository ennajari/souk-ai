"""Carte Souk.AI service — prepaid NFC card management."""
import logging
import hashlib
import hmac
import os
import secrets

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.souk_card import SoukCard, CardTransaction, CardStatus, CardTransactionType, CardType

logger = logging.getLogger("souk_ai")


def _hash_pin(pin: str, salt: bytes | None = None) -> str:
    """Hash PIN with PBKDF2-HMAC-SHA256 + random salt. Returns 'salt_hex:hash_hex'."""
    if salt is None:
        salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt, iterations=100_000)
    return salt.hex() + ":" + dk.hex()


def _generate_card_number(card_type: str = "CLIENT") -> str:
    """Generate a 16-digit Souk.AI card number. Client: 9212, Supplier: 9213."""
    prefix = "9213" if card_type == "SUPPLIER" else "9212"
    body = "".join([str(secrets.randbelow(10)) for _ in range(12)])
    return prefix + body


def _verify_pin(card: SoukCard, pin: str) -> bool:
    """Verify PIN against stored hash. Supports both legacy SHA-256 and new PBKDF2 format."""
    stored = card.pin_hash
    if ":" in stored:
        # New format: salt_hex:hash_hex (PBKDF2)
        salt_hex, hash_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        dk = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt, iterations=100_000)
        return hmac.compare_digest(dk.hex(), hash_hex)
    else:
        # Legacy format: plain SHA-256 (backward compatible)
        return hmac.compare_digest(stored, hashlib.sha256(pin.encode()).hexdigest())


async def register_card(
    db: AsyncSession,
    holder_name: str,
    holder_phone: str,
    pin: str,
    nfc_uid: str | None = None,
    card_type: str = "CLIENT",
    card_number: str | None = None,
) -> SoukCard:
    ct = CardType(card_type)

    if card_number:
        # Activate a pre-printed physical card
        existing = await db.execute(select(SoukCard).where(SoukCard.card_number == card_number))
        if existing.scalar_one_or_none():
            raise ValueError(f"La carte {card_number} est deja enregistree")
    else:
        # Auto-generate card number
        card_number = _generate_card_number(card_type)
        existing = await db.execute(select(SoukCard).where(SoukCard.card_number == card_number))
        while existing.scalar_one_or_none():
            card_number = _generate_card_number(card_type)
            existing = await db.execute(select(SoukCard).where(SoukCard.card_number == card_number))

    card = SoukCard(
        card_number=card_number,
        holder_name=holder_name,
        holder_phone=holder_phone,
        pin_hash=_hash_pin(pin),
        nfc_uid=nfc_uid,
        card_type=ct,
    )
    db.add(card)
    await db.flush()
    logger.info(f"New Souk.AI {card_type} card registered: {card_number} for {holder_phone}")
    return card


async def get_card(db: AsyncSession, card_number: str) -> SoukCard | None:
    result = await db.execute(select(SoukCard).where(SoukCard.card_number == card_number))
    return result.scalar_one_or_none()


async def get_card_by_nfc(db: AsyncSession, nfc_uid: str) -> SoukCard | None:
    result = await db.execute(select(SoukCard).where(SoukCard.nfc_uid == nfc_uid))
    return result.scalar_one_or_none()


async def get_card_by_phone(db: AsyncSession, phone: str) -> list[SoukCard]:
    result = await db.execute(
        select(SoukCard).where(SoukCard.holder_phone == phone, SoukCard.status == CardStatus.ACTIVE)
    )
    return result.scalars().all()


async def top_up_card(
    db: AsyncSession,
    card_number: str,
    amount: float,
    bank_reference: str | None = None,
) -> dict:
    card = await get_card(db, card_number)
    if not card:
        return {"success": False, "error": "Carte introuvable"}
    if card.status != CardStatus.ACTIVE:
        return {"success": False, "error": "Carte suspendue"}
    if amount <= 0 or amount > 5000:
        return {"success": False, "error": "Montant invalide (1-5000 MAD)"}

    card.balance = float(card.balance) + amount
    new_balance = float(card.balance)

    txn = CardTransaction(
        card_id=card.id,
        type=CardTransactionType.TOP_UP,
        amount=amount,
        balance_after=new_balance,
        reference=bank_reference or f"TOPUP-{card.card_number[-4:]}",
        description=f"Recharge +{amount:.2f} MAD",
    )
    db.add(txn)
    await db.flush()

    logger.info(f"Card {card_number} topped up: +{amount} MAD → balance {new_balance}")
    return {"success": True, "balance": new_balance, "transaction_id": txn.id}


async def pay_with_soukcard(
    db: AsyncSession,
    amount: float,
    merchant_id: str,
    reference: str,
    card_number: str | None = None,
    nfc_uid: str | None = None,
    pin: str | None = None,
) -> dict:
    if nfc_uid:
        card = await get_card_by_nfc(db, nfc_uid)
    elif card_number:
        card = await get_card(db, card_number)
    else:
        return {"success": False, "error": "Carte requise"}

    if not card:
        return {"success": False, "error": "Carte introuvable"}
    if card.status != CardStatus.ACTIVE:
        return {"success": False, "error": "Carte suspendue"}

    # PIN required for amounts > 50 MAD (NFC contactless limit)
    NFC_CONTACTLESS_LIMIT = 50.0
    if amount > NFC_CONTACTLESS_LIMIT and not pin:
        return {"success": False, "error": f"Code PIN requis pour les paiements > {NFC_CONTACTLESS_LIMIT:.0f} MAD"}

    if pin and not _verify_pin(card, pin):
        return {"success": False, "error": "Code PIN incorrect"}

    if float(card.balance) < amount:
        return {"success": False, "error": f"Solde insuffisant ({float(card.balance):.2f} MAD < {amount:.2f} MAD)"}

    card.balance = float(card.balance) - amount
    new_balance = float(card.balance)

    txn = CardTransaction(
        card_id=card.id,
        type=CardTransactionType.PAYMENT,
        amount=amount,
        balance_after=new_balance,
        merchant_id=merchant_id,
        reference=reference,
        description=f"Paiement -{amount:.2f} MAD",
    )
    db.add(txn)
    await db.flush()

    logger.info(f"Card {card.card_number} payment: -{amount} MAD → balance {new_balance}")
    return {"success": True, "balance": new_balance, "transaction_id": txn.id}


async def get_card_transactions(db: AsyncSession, card_id: str, limit: int = 50) -> list[CardTransaction]:
    result = await db.execute(
        select(CardTransaction)
        .where(CardTransaction.card_id == card_id)
        .order_by(CardTransaction.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
