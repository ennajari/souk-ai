from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

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
    merchant: Annotated[Merchant, Depends(get_current_merchant)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    # Fix N+1: load Product in the same query via JOIN
    query = (
        select(Transaction)
        .options(selectinload(Transaction.product))
        .where(Transaction.merchant_id == merchant.id)
    )
    if type:
        query = query.where(Transaction.type == type)
    query = query.order_by(desc(Transaction.created_at)).limit(limit)

    result = await db.execute(query)
    txns = result.scalars().all()

    return [
        TransactionResponse(
            id=t.id, merchant_id=t.merchant_id, product_id=t.product_id,
            customer_id=t.customer_id,
            product_name_ar=t.product.name_ar if t.product else None,
            product_name_fr=t.product.name_fr if t.product else None,
            type=t.type.value, source=t.source.value,
            quantity=t.quantity, unit_price=float(t.unit_price),
            total_amount=float(t.total_amount), created_at=t.created_at,
        )
        for t in txns
    ]


@router.post("/", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    req: TransactionCreate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify product belongs to merchant
    prod_result = await db.execute(
        select(Product).where(Product.id == req.product_id, Product.merchant_id == merchant.id)
    )
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    # Get inventory
    inv_result = await db.execute(select(Inventory).where(Inventory.product_id == req.product_id))
    inv = inv_result.scalar_one_or_none()

    # Fix stock négatif: block sale if insufficient stock
    if req.type == "SALE" and inv:
        available = float(inv.quantity)
        if available < req.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuffisant — disponible: {available:.0f}, demandé: {req.quantity}"
            )

    # Fix retour: RETURN adds back to stock (negative quantity on sale side)
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
    if inv:
        if req.type == "SALE":
            inv.quantity = float(inv.quantity) - req.quantity
        elif req.type in ("PURCHASE", "RETURN"):
            inv.quantity = float(inv.quantity) + req.quantity
        inv.updated_at = datetime.now(timezone.utc)

    await db.flush()

    return TransactionResponse(
        id=txn.id, merchant_id=txn.merchant_id, product_id=txn.product_id,
        customer_id=txn.customer_id,
        product_name_ar=product.name_ar, product_name_fr=product.name_fr,
        type=txn.type.value, source=txn.source.value,
        quantity=txn.quantity, unit_price=float(txn.unit_price),
        total_amount=float(txn.total_amount), created_at=txn.created_at,
    )


@router.post("/{transaction_id}/return", response_model=TransactionResponse, status_code=201)
async def return_transaction(
    transaction_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Annuler/retourner une vente — recrédite le stock automatiquement."""
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.merchant_id == merchant.id,
            Transaction.type == TransactionType.SALE,
        )
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(404, "Vente introuvable ou déjà retournée")

    prod_result = await db.execute(select(Product).where(Product.id == original.product_id))
    product = prod_result.scalar_one_or_none()

    # Create RETURN transaction
    return_txn = Transaction(
        merchant_id=merchant.id,
        product_id=original.product_id,
        customer_id=original.customer_id,
        type=TransactionType.RETURN,
        source=original.source,
        quantity=original.quantity,
        unit_price=original.unit_price,
        total_amount=original.total_amount,
    )
    db.add(return_txn)

    # Add stock back
    inv_result = await db.execute(select(Inventory).where(Inventory.product_id == original.product_id))
    inv = inv_result.scalar_one_or_none()
    if inv:
        inv.quantity = float(inv.quantity) + original.quantity
        inv.updated_at = datetime.now(timezone.utc)

    await db.flush()

    return TransactionResponse(
        id=return_txn.id, merchant_id=return_txn.merchant_id,
        product_id=return_txn.product_id, customer_id=return_txn.customer_id,
        product_name_ar=product.name_ar if product else None,
        product_name_fr=product.name_fr if product else None,
        type=return_txn.type.value, source=return_txn.source.value,
        quantity=return_txn.quantity, unit_price=float(return_txn.unit_price),
        total_amount=float(return_txn.total_amount), created_at=return_txn.created_at,
    )
