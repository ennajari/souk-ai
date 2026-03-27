from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionType, TransactionSource
from schemas.transaction import TransactionCreate, TransactionResponse

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/", response_model=list[TransactionResponse])
async def list_transactions(
    type: str | None = None,
    limit: int = Query(50, le=200),
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    query = select(Transaction).where(Transaction.merchant_id == merchant.id)
    if type:
        query = query.where(Transaction.type == type)
    query = query.order_by(desc(Transaction.created_at)).limit(limit)

    result = await db.execute(query)
    txns = result.scalars().all()

    response = []
    for t in txns:
        # Get product info
        prod_result = await db.execute(select(Product).where(Product.id == t.product_id))
        product = prod_result.scalar_one_or_none()

        response.append(TransactionResponse(
            id=t.id, merchant_id=t.merchant_id, product_id=t.product_id,
            product_name_ar=product.name_ar if product else None,
            product_name_fr=product.name_fr if product else None,
            type=t.type.value, source=t.source.value,
            quantity=t.quantity, unit_price=float(t.unit_price),
            total_amount=float(t.total_amount), created_at=t.created_at,
        ))
    return response


@router.post("/", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    req: TransactionCreate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    # Verify product belongs to merchant
    prod_result = await db.execute(
        select(Product).where(Product.id == req.product_id, Product.merchant_id == merchant.id)
    )
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    total = req.quantity * req.unit_price

    txn = Transaction(
        merchant_id=merchant.id,
        product_id=req.product_id,
        customer_id=req.customer_id,
        type=TransactionType(req.type),
        source=TransactionSource(req.source),
        quantity=req.quantity,
        unit_price=req.unit_price,
        total_amount=total,
    )
    db.add(txn)

    # Update inventory
    inv_result = await db.execute(select(Inventory).where(Inventory.product_id == req.product_id))
    inv = inv_result.scalar_one_or_none()
    if inv:
        if req.type == "SALE":
            inv.quantity = float(inv.quantity) - req.quantity
        elif req.type == "PURCHASE":
            inv.quantity = float(inv.quantity) + req.quantity
        inv.updated_at = datetime.now(timezone.utc)

    await db.flush()

    return TransactionResponse(
        id=txn.id, merchant_id=txn.merchant_id, product_id=txn.product_id,
        product_name_ar=product.name_ar, product_name_fr=product.name_fr,
        type=txn.type.value, source=txn.source.value,
        quantity=txn.quantity, unit_price=float(txn.unit_price),
        total_amount=float(txn.total_amount), created_at=txn.created_at,
    )
