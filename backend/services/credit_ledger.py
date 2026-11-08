"""Customer credit book ("karni"): one code path for the Customers page and POS credit sales."""
import logging
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.money import to_money
from models.customer import CreditEntry, CreditEntryType, Customer

logger = logging.getLogger("souk_ai")


async def lock_customer(db: AsyncSession, customer_id: str, merchant_id: str) -> Customer:
    """Load the merchant's own customer with a row lock (balance read-modify-write is serialized)."""
    customer = (await db.execute(
        select(Customer)
        .where(Customer.id == customer_id, Customer.merchant_id == merchant_id)
        .with_for_update()
    )).scalar_one_or_none()
    if not customer:
        raise HTTPException(404, "Client introuvable")
    return customer


def apply_entry(
    db: AsyncSession, customer: Customer, merchant_id: str, entry_type: str, amount, description: str | None,
) -> CreditEntry:
    """Validate and book a CREDIT (customer owes more) or PAYMENT (customer pays back). Caller holds the lock."""
    amount = to_money(amount)
    if amount <= 0:
        raise HTTPException(400, "Montant invalide")
    balance = to_money(customer.balance)
    limit = to_money(customer.credit_limit)
    if entry_type == "CREDIT":
        if limit > 0 and balance + amount > limit:
            raise HTTPException(
                400, f"Plafond de crédit atteint — disponible: {limit - balance:.2f} / limite: {limit:.2f}"
            )
        customer.balance = balance + amount
    elif entry_type == "PAYMENT":
        if amount > balance:
            raise HTTPException(400, f"Montant du paiement ({amount:.2f}) supérieur au solde dû ({balance:.2f})")
        customer.balance = balance - amount
    else:
        raise HTTPException(422, "type doit etre CREDIT ou PAYMENT")
    entry = CreditEntry(
        customer_id=customer.id, merchant_id=merchant_id, type=CreditEntryType(entry_type),
        amount=amount, description=(description or "")[:255] or None,
    )
    db.add(entry)
    return entry


async def notify_credit(
    phone: str | None, name: str | None, shop: str, amount: Decimal, balance: Decimal,
    description: str | None, currency: str = "MAD",
) -> None:
    """Best-effort WhatsApp receipt to the customer (template first, free text inside the 24 h window)."""
    if not phone:
        return
    from services.whatsapp import normalize_phone, send_template_message, send_text_message
    to = normalize_phone(phone)
    first_name = (name or "Client").split()[0]
    amount_str, balance_str = f"{amount:.2f}", f"{balance:.2f}"
    try:
        await send_template_message(
            to=to, template_name="credit_notification", language="fr",
            body_params=[first_name, amount_str, shop, balance_str],
        )
        return
    except Exception as e:  # noqa: BLE001
        logger.info("credit template failed (%s), falling back to text", e)
    msg = (
        f"Bonjour {first_name} 👋\n\nUn crédit a été enregistré sur votre compte :\n\n"
        f"💰 Montant : {amount_str} {currency}\n"
        + (f"\n🛒 Détails :\n— {description}\n" if description else "")
        + f"\n📍 Boutique : {shop}\n📅 Date : {datetime.now().strftime('%d/%m/%Y')}\n"
        f"💳 Solde total : {balance_str} {currency}\n\nMerci de régulariser votre situation\n"
        f"dès que possible. 🙏\n\n— Souk.AI"
    )
    try:
        await send_text_message(to, msg)
    except Exception as e:  # noqa: BLE001
        logger.warning("credit notification failed for customer: %s", e)
