from typing import Annotated
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.customer import Customer, CreditEntry
from models.transaction import Transaction
from models.product import Product
from schemas.customer import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    CustomerListResponse, CreditEntryCreate, CreditEntryResponse,
)
from services.credit_ledger import apply_entry, lock_customer, notify_credit
from services.whatsapp import normalize_phone, send_text_message

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
    background: BackgroundTasks,
):
    customer = await lock_customer(db, customer_id, merchant.id)
    entry = apply_entry(db, customer, merchant.id, data.type, data.amount, data.description)
    await db.commit()
    await db.refresh(entry)
    if data.type == "CREDIT":
        background.add_task(
            notify_credit, customer.phone, customer.name, merchant.business_name,
            entry.amount, customer.balance, data.description, merchant.currency or "MAD",
        )
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
