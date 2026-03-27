from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.supplier import Supplier
from models.supplier_order import SupplierOrder, SupplierOrderStatus
from models.product import Product
from schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse, SupplierOrderResponse
from services.supplier_aggregation import create_aggregated_bulk_order

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("/", response_model=list[SupplierResponse])
async def list_suppliers(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.is_active == True))
    return result.scalars().all()


@router.post("/", response_model=SupplierResponse, status_code=201)
async def create_supplier(
    data: SupplierCreate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    if data.minimum_order_value < 0:
        raise HTTPException(400, "La commande minimum ne peut pas etre negative")
    existing = await db.execute(
        select(Supplier).where(Supplier.name == data.name, Supplier.is_active == True)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Le fournisseur '{data.name}' existe deja")
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    await db.flush()
    await db.refresh(supplier)
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    if data.minimum_order_value is not None and data.minimum_order_value < 0:
        raise HTTPException(400, "La commande minimum ne peut pas etre negative")
    if data.name and data.name != supplier.name:
        dup = await db.execute(
            select(Supplier).where(Supplier.name == data.name, Supplier.is_active == True, Supplier.id != supplier_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(400, f"Le fournisseur '{data.name}' existe deja")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    await db.flush()
    await db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=204)
async def delete_supplier(
    supplier_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    supplier.is_active = False
    await db.flush()


@router.get("/{supplier_id}/orders", response_model=list[SupplierOrderResponse])
async def list_supplier_orders(
    supplier_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupplierOrder).where(
            SupplierOrder.supplier_id == supplier_id,
            SupplierOrder.merchant_id == merchant.id,
        )
    )
    return result.scalars().all()


@router.post("/{supplier_id}/order", response_model=SupplierOrderResponse, status_code=201)
async def place_order(
    supplier_id: str,
    product_id: str,
    quantity: int,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    sup_result = await db.execute(select(Supplier).where(Supplier.id == supplier_id, Supplier.is_active == True))
    supplier = sup_result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    prod_result = await db.execute(
        select(Product).where(Product.id == product_id, Product.merchant_id == merchant.id)
    )
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    total = quantity * float(product.cost_price)
    order = SupplierOrder(
        merchant_id=merchant.id,
        supplier_id=supplier_id,
        items=[{"product_id": product.id, "product_name": product.name_ar,
                "quantity": quantity, "unit_price": float(product.cost_price)}],
        total_amount=total,
        status=SupplierOrderStatus.PENDING,
    )
    db.add(order)
    await db.flush()
    await db.refresh(order)
    return order


@router.post("/{supplier_id}/aggregate")
async def aggregate_orders(
    supplier_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    return await create_aggregated_bulk_order(db, supplier.id)
