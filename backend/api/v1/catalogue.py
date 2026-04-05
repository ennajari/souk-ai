from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.database import get_db
from models.merchant import Merchant
from models.product import Product

router = APIRouter(prefix="/catalogue", tags=["catalogue"])


class CatalogueProduct(BaseModel):
    id: str
    name_ar: str
    name_fr: str
    unit: str
    unit_price: float
    stock: int

    model_config = {"from_attributes": True}


class CatalogueResponse(BaseModel):
    business_name: str
    category: str
    phone: str
    products: list[CatalogueProduct]


@router.get("/{merchant_id}", response_model=CatalogueResponse)
async def get_public_catalogue(
    merchant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — no auth required. Returns active products for a merchant."""
    result = await db.execute(
        select(Merchant).where(Merchant.id == merchant_id)
    )
    merchant = result.scalar_one_or_none()
    if not merchant:
        raise HTTPException(404, "Commerce introuvable")

    prod_result = await db.execute(
        select(Product)
        .where(Product.merchant_id == merchant_id, Product.is_active is True)
        .options(selectinload(Product.inventory))
        .order_by(Product.name_fr)
    )
    products = prod_result.scalars().all()

    items = []
    for p in products:
        items.append(CatalogueProduct(
            id=p.id,
            name_ar=p.name_ar,
            name_fr=p.name_fr,
            unit=p.unit,
            unit_price=float(p.unit_price),
            stock=p.inventory.quantity if p.inventory else 0,
        ))

    return CatalogueResponse(
        business_name=merchant.business_name,
        category=merchant.business_category.value,
        phone=merchant.phone_number,
        products=items,
    )
