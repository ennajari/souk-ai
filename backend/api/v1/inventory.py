from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.product import Product
from models.inventory import Inventory
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
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Inventory)
        .join(Product)
        .where(Product.merchant_id == merchant.id, Product.is_active == True)
    )
    result = await db.execute(query)
    items = result.scalars().all()

    if low_stock_only:
        items = [i for i in items if float(i.quantity) <= i.reorder_threshold]

    return [_to_response(i) for i in items]


@router.get("/alerts", response_model=list[InventoryResponse])
async def get_alerts(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Inventory)
        .join(Product)
        .where(Product.merchant_id == merchant.id, Product.is_active == True)
    )
    result = await db.execute(query)
    items = result.scalars().all()
    low = [i for i in items if float(i.quantity) <= i.reorder_threshold]
    return [_to_response(i) for i in low]


@router.post("/adjust", response_model=InventoryResponse)
async def adjust_inventory(
    req: InventoryAdjust,
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

    result = await db.execute(select(Inventory).where(Inventory.product_id == req.product_id))
    inv = result.scalar_one_or_none()
    if not inv:
        inv = Inventory(product_id=req.product_id, quantity=0)
        db.add(inv)
        await db.flush()

    inv.quantity = float(inv.quantity) + req.quantity_change
    inv.updated_at = datetime.now(timezone.utc)
    await db.flush()

    # Reload with product
    result = await db.execute(
        select(Inventory).where(Inventory.id == inv.id)
    )
    inv = result.scalar_one()
    return _to_response(inv)


@router.patch("/{product_id}/threshold", response_model=InventoryResponse)
async def update_threshold(
    product_id: str,
    req: ThresholdUpdate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Inventory).join(Product).where(
            Inventory.product_id == product_id, Product.merchant_id == merchant.id
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventaire introuvable")

    inv.reorder_threshold = req.reorder_threshold
    await db.flush()
    return _to_response(inv)
