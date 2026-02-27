from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.product import Product
from models.inventory import Inventory
from schemas.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=list[ProductResponse])
async def list_products(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.merchant_id == merchant.id, Product.is_active == True)
    )
    products = result.scalars().all()

    response = []
    for p in products:
        stock = None
        if p.inventory:
            stock = float(p.inventory.quantity)
        response.append(ProductResponse(
            id=p.id, merchant_id=p.merchant_id, name_ar=p.name_ar, name_fr=p.name_fr,
            barcode=p.barcode, unit=p.unit, unit_price=float(p.unit_price),
            cost_price=float(p.cost_price), is_active=p.is_active,
            created_at=p.created_at, stock_quantity=stock,
        ))
    return response


@router.post("/", response_model=ProductResponse, status_code=201)
async def create_product(
    req: ProductCreate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    product = Product(merchant_id=merchant.id, **req.model_dump())
    db.add(product)
    await db.flush()

    # Create inventory entry
    inventory = Inventory(product_id=product.id, quantity=0)
    db.add(inventory)
    await db.flush()

    return ProductResponse(
        id=product.id, merchant_id=product.merchant_id, name_ar=product.name_ar,
        name_fr=product.name_fr, barcode=product.barcode, unit=product.unit,
        unit_price=float(product.unit_price), cost_price=float(product.cost_price),
        is_active=product.is_active, created_at=product.created_at, stock_quantity=0,
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.merchant_id == merchant.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    stock = float(product.inventory.quantity) if product.inventory else None
    return ProductResponse(
        id=product.id, merchant_id=product.merchant_id, name_ar=product.name_ar,
        name_fr=product.name_fr, barcode=product.barcode, unit=product.unit,
        unit_price=float(product.unit_price), cost_price=float(product.cost_price),
        is_active=product.is_active, created_at=product.created_at, stock_quantity=stock,
    )


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    req: ProductUpdate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.merchant_id == merchant.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    await db.flush()
    stock = float(product.inventory.quantity) if product.inventory else None
    return ProductResponse(
        id=product.id, merchant_id=product.merchant_id, name_ar=product.name_ar,
        name_fr=product.name_fr, barcode=product.barcode, unit=product.unit,
        unit_price=float(product.unit_price), cost_price=float(product.cost_price),
        is_active=product.is_active, created_at=product.created_at, stock_quantity=stock,
    )


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.merchant_id == merchant.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    product.is_active = False
    await db.flush()
