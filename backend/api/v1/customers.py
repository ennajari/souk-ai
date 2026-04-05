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

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("/", response_model=list[CustomerListResponse])
async def list_customers(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.merchant_id == merchant.id, Customer.is_active is True)
        .order_by(Customer.name)
    )
    return result.scalars().all()


@router.post("/", response_model=CustomerResponse, status_code=201)
async def create_customer(
    data: CustomerCreate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    # Check duplicate by name
    existing = await db.execute(
        select(Customer).where(
            Customer.merchant_id == merchant.id,
            Customer.name == data.name,
            Customer.is_active is True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Le client '{data.name}' existe deja")

    customer = Customer(merchant_id=merchant.id, **data.model_dump())
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, "Client introuvable")
    return customer


@router.patch("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    data: CustomerUpdate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, "Client introuvable")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(customer, key, value)
    await db.flush()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, "Client introuvable")
    customer.is_active = False
    await db.flush()


@router.post("/{customer_id}/entries", response_model=CreditEntryResponse, status_code=201)
async def add_credit_entry(
    customer_id: str,
    data: CreditEntryCreate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, "Client introuvable")

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
        customer.balance = float(customer.balance) - data.amount

    await db.flush()
    await db.refresh(entry)
    return entry


@router.get("/{customer_id}/purchases")
async def get_customer_purchases(
    customer_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    # Verify customer belongs to merchant
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.merchant_id == merchant.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Client introuvable")

    # Get transactions for this customer
    txn_result = await db.execute(
        select(Transaction).where(
            Transaction.customer_id == customer_id,
            Transaction.merchant_id == merchant.id,
        ).order_by(Transaction.created_at.desc()).limit(50)
    )
    txns = txn_result.scalars().all()

    purchases = []
    for t in txns:
        prod_r = await db.execute(select(Product).where(Product.id == t.product_id))
        prod = prod_r.scalar_one_or_none()
        purchases.append({
            "id": t.id,
            "product_name": (prod.name_fr or prod.name_ar) if prod else "Inconnu",
            "quantity": t.quantity,
            "unit_price": float(t.unit_price),
            "total": float(t.total_amount),
            "date": t.created_at.isoformat(),
        })
    return purchases
