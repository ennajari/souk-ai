"""Carte Souk.AI service — prepaid NFC card management."""
import logging
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.money import to_money
from core.ratelimit import get_redis

from models.souk_card import SoukCard, CardTransaction, CardStatus, CardTransactionType, CardType

logger = logging.getLogger("souk_ai")

NFC_CONTACTLESS_LIMIT = Decimal("50")
PIN_MAX_FAILURES = 5
PIN_LOCK_S = 30 * 60
# Top-ups are cash the merchant receives on behalf of the card network: cap the daily exposure
# per merchant until settlement with a licensed e-money partner exists (AUDIT K1).
MERCHANT_DAILY_TOPUP_CAP = Decimal("10000")


async def _pin_locked(card_id: str) -> bool:
    try:
        return int(await get_redis().get(f"pinfail:{card_id}") or 0) >= PIN_MAX_FAILURES
    except Exception:  # noqa: BLE001
        return False


async def _pin_failed(card_id: str) -> None:
    try:
        r = get_redis()
        await r.incr(f"pinfail:{card_id}")
        await r.expire(f"pinfail:{card_id}", PIN_LOCK_S)
    except Exception:  # noqa: BLE001
        logger.warning("could not record PIN failure for card %s", card_id)


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


async def get_card(db: AsyncSession, card_number: str, for_update: bool = False) -> SoukCard | None:
    q = select(SoukCard).where(SoukCard.card_number == card_number)
    result = await db.execute(q.with_for_update() if for_update else q)
    return result.scalar_one_or_none()


async def get_card_by_nfc(db: AsyncSession, nfc_uid: str, for_update: bool = False) -> SoukCard | None:
    q = select(SoukCard).where(SoukCard.nfc_uid == nfc_uid)
    result = await db.execute(q.with_for_update() if for_update else q)
    return result.scalar_one_or_none()


async def get_card_by_phone(db: AsyncSession, phone: str) -> list[SoukCard]:
    result = await db.execute(
        select(SoukCard).where(SoukCard.holder_phone == phone, SoukCard.status == CardStatus.ACTIVE)
    )
    return result.scalars().all()


async def top_up_card(
    db: AsyncSession,
    card_number: str,
    amount: float | Decimal,
    bank_reference: str | None = None,
    merchant_id: str | None = None,
) -> dict:
    amount = to_money(amount)
    if amount <= 0 or amount > 5000:
        return {"success": False, "error": "Montant invalide (1-5000 MAD)"}
    card = await get_card(db, card_number, for_update=True)
    if not card:
        return {"success": False, "error": "Carte introuvable"}
    if card.status != CardStatus.ACTIVE:
        return {"success": False, "error": "Carte suspendue"}

    if merchant_id:
        since = datetime.now(timezone.utc) - timedelta(days=1)
        today_total = (await db.execute(
            select(func.coalesce(func.sum(CardTransaction.amount), 0)).where(
                CardTransaction.merchant_id == merchant_id,
                CardTransaction.type == CardTransactionType.TOP_UP,
                CardTransaction.created_at >= since,
            )
        )).scalar_one()
        if Decimal(today_total) + amount > MERCHANT_DAILY_TOPUP_CAP:
            return {"success": False, "error": f"Plafond de recharge sur 24 h atteint ({MERCHANT_DAILY_TOPUP_CAP} MAD)"}

    card.balance = to_money(card.balance) + amount
    new_balance = card.balance

    txn = CardTransaction(
        card_id=card.id,
        type=CardTransactionType.TOP_UP,
        amount=amount,
        balance_after=new_balance,
        merchant_id=merchant_id,  # who received the cash — needed for settlement/audit
        reference=bank_reference or f"TOPUP-{card.card_number[-4:]}",
        description=f"Recharge +{amount:.2f} MAD",
    )
    db.add(txn)
    await db.flush()

    logger.info("card ...%s topped up +%s by merchant %s", card_number[-4:], amount, merchant_id)
    return {"success": True, "balance": float(new_balance), "transaction_id": txn.id}


async def pay_with_soukcard(
    db: AsyncSession,
    amount: float | Decimal,
    merchant_id: str,
    reference: str,
    card_number: str | None = None,
    nfc_uid: str | None = None,
    pin: str | None = None,
) -> dict:
    """Debit a card inside the caller's DB transaction (row-locked; the caller commits)."""
    amount = to_money(amount)
    if amount <= 0:
        return {"success": False, "error": "Montant invalide"}
    if nfc_uid:
        card = await get_card_by_nfc(db, nfc_uid, for_update=True)
    elif card_number:
        card = await get_card(db, card_number, for_update=True)
    else:
        return {"success": False, "error": "Carte requise"}

    if not card:
        return {"success": False, "error": "Carte introuvable"}
    if card.status != CardStatus.ACTIVE:
        return {"success": False, "error": "Carte suspendue"}
    if await _pin_locked(card.id):
        return {"success": False, "error": "Carte bloquee apres trop de codes PIN incorrects. Reessayez dans 30 min."}

    # No-PIN contactless only for a physical NFC tap: a typed card number is not proof of possession.
    pin_required = not nfc_uid or amount > NFC_CONTACTLESS_LIMIT
    if pin_required and not pin:
        return {"success": False, "error": "Code PIN requis"}

    if pin and not _verify_pin(card, pin):
        await _pin_failed(card.id)
        return {"success": False, "error": "Code PIN incorrect"}

    balance = to_money(card.balance)
    if balance < amount:
        return {"success": False, "error": f"Solde insuffisant ({balance} < {amount})"}

    card.balance = balance - amount
    txn = CardTransaction(
        card_id=card.id,
        type=CardTransactionType.PAYMENT,
        amount=amount,
        balance_after=card.balance,
        merchant_id=merchant_id,
        reference=reference,
        description=f"Paiement -{amount}",
    )
    db.add(txn)
    await db.flush()

    logger.info("card ...%s paid %s to merchant %s", card.card_number[-4:], amount, merchant_id)
    return {"success": True, "balance": float(card.balance), "transaction_id": txn.id}


async def get_card_transactions(db: AsyncSession, card_id: str, limit: int = 50) -> list[CardTransaction]:
    result = await db.execute(
        select(CardTransaction)
        .where(CardTransaction.card_id == card_id)
        .order_by(CardTransaction.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
