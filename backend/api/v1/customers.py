from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.customer import Customer, CreditEntry, CreditEntryType
from models.transaction import Transaction
from models.product import Product
from schemas.customer import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    CustomerListResponse, CreditEntryCreate, CreditEntryResponse,
)
from services.whatsapp import send_text_message, send_template_message, normalize_phone

router = APIRouter(prefix="/customers", tags=["Customers"])

CLIENT_NOT_FOUND = "Client introuvable"


@router.get("/", response_model=list[CustomerListResponse])
async def list_customers(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Customer).where(Customer.merchant_id == merchant.id, Customer.is_active == True)
        .order_by(Customer.name)
    )
    return result.scalars().all()


@router.post("/", response_model=CustomerResponse, status_code=201)
async def create_customer(
    data: CustomerCreate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check duplicate by name
    existing = await db.execute(
        select(Customer).where(
            Customer.merchant_id == merchant.id,
            Customer.name == data.name,
            Customer.is_active == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Le client '{data.name}' existe deja")

    customer = Customer(merchant_id=merchant.id, **data.model_dump())
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, CLIENT_NOT_FOUND)
    return customer


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    data: CustomerUpdate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, CLIENT_NOT_FOUND)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, key, value)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, CLIENT_NOT_FOUND)
    customer.is_active = False
    await db.commit()


@router.post("/{customer_id}/entries", response_model=CreditEntryResponse, status_code=201)
async def add_credit_entry(
    customer_id: str,
    data: CreditEntryCreate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, CLIENT_NOT_FOUND)

    # Check credit limit (0 = no limit)
    if data.type == "CREDIT" and customer.credit_limit > 0:
        new_balance = float(customer.balance) + data.amount
        if new_balance > float(customer.credit_limit):
            remaining = float(customer.credit_limit) - float(customer.balance)
            raise HTTPException(
                400,
                f"Plafond de crédit atteint — disponible: {remaining:.2f} MAD / limite: {customer.credit_limit:.2f} MAD"
            )

    entry = CreditEntry(
        customer_id=customer_id,
        merchant_id=merchant.id,
        type=CreditEntryType(data.type),
        amount=data.amount,
        description=data.description,
    )
    db.add(entry)

    # Update balance
    if data.type == "CREDIT":
        customer.balance = float(customer.balance) + data.amount
    elif data.type == "PAYMENT":
        current_balance = float(customer.balance)
        if data.amount > current_balance:
            raise HTTPException(
                400,
                f"Montant du paiement ({data.amount:.2f} MAD) supérieur au solde dû ({current_balance:.2f} MAD)"
            )
        customer.balance = current_balance - data.amount

    await db.commit()
    await db.refresh(entry)

    # Auto-send WhatsApp notification to client for CREDIT entries
    if data.type == "CREDIT" and customer.phone:
        try:
            phone_normalized = normalize_phone(customer.phone)
            first_name = customer.name.split()[0] if customer.name else "Client"
            amount_str = f"{data.amount:.2f}"
            balance_str = f"{float(customer.balance):.2f}"
            print(f"[WhatsApp Credit] Sending to {customer.name} — raw: {customer.phone}, normalized: {phone_normalized}")

            # Try template first (works even outside 24h window)
            try:
                result = await send_template_message(
                    to=phone_normalized,
                    template_name="credit_notification",
                    language="fr",
                    body_params=[first_name, amount_str, merchant.business_name, balance_str],
                )
                print(f"[WhatsApp Credit] ✅ Template sent to {phone_normalized} — result: {result}")
            except Exception as tmpl_err:
                print(f"[WhatsApp Credit] Template failed ({tmpl_err}), trying free-form text...")
                # Fallback: free-form text (only works within 24h window)
                from datetime import datetime
                date_str = datetime.now().strftime("%d/%m/%Y")
                products_line = f"— {data.description}" if data.description else ""
                msg = (
                    f"Bonjour {first_name} 👋\n\n"
                    f"Un crédit a été enregistré sur votre compte :\n\n"
                    f"💰 Montant : {amount_str} MAD\n"
                )
                if products_line:
                    msg += f"\n🛒 Détails :\n{products_line}\n"
                msg += (
                    f"\n📍 Boutique : {merchant.business_name}\n"
                    f"📅 Date : {date_str}\n"
                    f"💳 Solde total : {balance_str} MAD\n\n"
                    f"Merci de régulariser votre situation\n"
                    f"dès que possible. 🙏\n\n"
                    f"— Souk.AI"
                )
                result = await send_text_message(phone_normalized, msg)
                print(f"[WhatsApp Credit] ✅ Text fallback sent to {phone_normalized}")
        except Exception as e:
            print(f"[WhatsApp Credit] ❌ Failed for {customer.name} ({customer.phone}): {e}")

    return entry


@router.post("/{customer_id}/remind")
async def send_karni_reminder(
    customer_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Manually send a karni (credit) reminder to a customer via WhatsApp."""
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, CLIENT_NOT_FOUND)

    if not customer.phone:
        raise HTTPException(400, "Ce client n'a pas de numéro de téléphone")

    if float(customer.balance) <= 0:
        raise HTTPException(400, "Ce client n'a pas de solde en cours")

    # Find last entry for date info
    last_entry_result = await db.execute(
        select(CreditEntry).where(
            CreditEntry.customer_id == customer.id,
        ).order_by(CreditEntry.created_at.desc()).limit(1)
    )
    last_entry = last_entry_result.scalar_one_or_none()

    first_name = customer.name.split()[0] if customer.name else "Client"
    balance_str = f"{float(customer.balance):.2f}"
    shop_name = merchant.business_name or "Votre boutique"
    last_date = last_entry.created_at.strftime("%d/%m/%Y") if last_entry else "—"

    msg = (
        f"سلام {first_name} 👋\n\n"
        f"هذا تذكير بسيط — عندك {balance_str} درهم في الكارني ديال {shop_name}.\n\n"
        f"💳 المبلغ: {balance_str} MAD\n"
        f"📅 آخر عملية: {last_date}\n\n"
        f"الله يبارك فيك، خلص وقتما تقدر 🙏\n\n"
        f"— {shop_name} via Souk.AI"
    )

    phone_normalized = normalize_phone(customer.phone)
    try:
        await send_text_message(phone_normalized, msg)
    except Exception as e:
        raise HTTPException(502, f"Échec d'envoi WhatsApp: {str(e)}")

    return {"status": "sent", "phone": phone_normalized}


@router.get("/{customer_id}/purchases")
async def get_customer_purchases(
    customer_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify customer belongs to merchant
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, CLIENT_NOT_FOUND)

    # Get transactions for this customer
    txn_result = await db.execute(
        select(Transaction).where(
            Transaction.customer_id == customer_id,
            Transaction.merchant_id == merchant.id,
        ).order_by(Transaction.created_at.desc()).limit(50)
    )
    txns = txn_result.scalars().all()

    # Batch fetch all products in one query
    product_ids = [t.product_id for t in txns if t.product_id]
    products_map: dict = {}
    if product_ids:
        prod_rows = (await db.execute(
            select(Product).where(Product.id.in_(product_ids))
        )).scalars().all()
        products_map = {p.id: p for p in prod_rows}

    purchases = [
        {
            "id": t.id,
            "product_name": (
                (products_map[t.product_id].name_fr or products_map[t.product_id].name_ar)
                if t.product_id and t.product_id in products_map else "Inconnu"
            ),
            "quantity": t.quantity,
            "unit_price": float(t.unit_price),
            "total": float(t.total_amount),
            "date": t.created_at.isoformat(),
        }
        for t in txns
    ]
    return purchases
