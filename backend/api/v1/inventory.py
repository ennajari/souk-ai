from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.deps import get_current_merchant
from core.money import to_money
from models.merchant import Merchant
from models.product import Product
from models.inventory import Inventory, InventoryLog
from schemas.inventory import InventoryResponse, InventoryAdjust, ThresholdUpdate

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _to_response(inv: Inventory) -> InventoryResponse:
    return InventoryResponse(
        id=inv.id,
        product_id=inv.product_id,
        product_name_ar=inv.product.name_ar if inv.product else None,
        product_name_fr=inv.product.name_fr if inv.product else None,
        quantity=float(inv.quantity),
        reorder_threshold=inv.reorder_threshold,
        unit=inv.product.unit if inv.product else None,
        updated_at=inv.updated_at,
    )


@router.get("/", response_model=list[InventoryResponse])
async def get_inventory(
    low_stock_only: bool = False,
    merchant: Annotated[Merchant, Depends(get_current_merchant)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    query = (
        select(Inventory)
        .join(Product)
        .options(selectinload(Inventory.product))
        .where(Product.merchant_id == merchant.id, Product.is_active == True)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    if low_stock_only:
        items = [i for i in items if float(i.quantity) <= i.reorder_threshold]

    return [_to_response(i) for i in items]


@router.get("/alerts", response_model=list[InventoryResponse])
async def get_alerts(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(Inventory)
        .join(Product)
        .options(selectinload(Inventory.product))
        .where(Product.merchant_id == merchant.id, Product.is_active == True)
    )
    result = await db.execute(query)
    items = result.scalars().all()
    low = [i for i in items if float(i.quantity) <= i.reorder_threshold]
    return [_to_response(i) for i in low]


@router.get("/logs")
async def get_inventory_logs(
    product_id: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    merchant: Annotated[Merchant, Depends(get_current_merchant)] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Audit trail — historique de toutes les modifications de stock."""
    query = (
        select(InventoryLog)
        .options(selectinload(InventoryLog.product))
        .where(InventoryLog.merchant_id == merchant.id)
        .order_by(desc(InventoryLog.created_at))
        .limit(limit)
    )
    if product_id:
        query = query.where(InventoryLog.product_id == product_id)
    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "product_id": log.product_id,
            "product_name": (log.product.name_fr or log.product.name_ar) if log.product else None,
            "quantity_before": float(log.quantity_before),
            "quantity_change": float(log.quantity_change),
            "quantity_after": float(log.quantity_after),
            "reason": log.reason,
            "source": log.source,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.post("/adjust", response_model=InventoryResponse)
async def adjust_inventory(
    req: InventoryAdjust,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Manual correction (stock count, breakage, theft). Logged; never leaves stock below zero."""
    if req.quantity_change == 0:
        raise HTTPException(422, "La variation de stock ne peut pas etre nulle")
    product = (await db.execute(
        select(Product).where(Product.id == req.product_id, Product.merchant_id == merchant.id)
    )).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    # Row lock: a sale and an adjustment at the same time must not overwrite each other
    inv = (await db.execute(
        select(Inventory).where(Inventory.product_id == req.product_id).with_for_update().execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if not inv:
        inv = Inventory(product_id=req.product_id, quantity=0)
        db.add(inv)
        await db.flush()

    qty_before = to_money(inv.quantity)
    qty_after = qty_before + to_money(req.quantity_change)
    if qty_after < 0:
        raise HTTPException(400, f"Le stock ne peut pas etre negatif (actuel: {float(qty_before):g})")
    inv.quantity = qty_after
    inv.updated_at = datetime.now(timezone.utc)
    db.add(InventoryLog(
        product_id=req.product_id, merchant_id=merchant.id, quantity_before=qty_before,
        quantity_change=to_money(req.quantity_change), quantity_after=qty_after,
        reason=req.reason or "Ajustement manuel", source="manual",
    ))
    await db.commit()
    return await _load_response(db, inv.id)


async def _load_response(db: AsyncSession, inventory_id: str) -> InventoryResponse:
    # Eager-load the product: lazy loading in async code raises MissingGreenlet
    inv = (await db.execute(
        select(Inventory).options(selectinload(Inventory.product)).where(Inventory.id == inventory_id)
    )).scalar_one()
    return _to_response(inv)


@router.patch("/{product_id}/threshold", response_model=InventoryResponse)
async def update_threshold(
    product_id: str,
    req: ThresholdUpdate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    inv = (await db.execute(
        select(Inventory).join(Product).where(
            Inventory.product_id == product_id, Product.merchant_id == merchant.id
        )
    )).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventaire introuvable")
    inv.reorder_threshold = req.reorder_threshold
    await db.commit()
    return await _load_response(db, inv.id)
