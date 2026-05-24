"""Supplier Catalog — READ-ONLY for merchants. Suppliers manage via /supplier-portal/catalog."""
from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.supplier import Supplier
from models.supplier_catalog import SupplierCatalogItem

router = APIRouter(prefix="/supplier-catalog", tags=["Supplier Catalog"])


class CatalogItemResponse(BaseModel):
    id: str
    supplier_id: str
    name: str
    unit: str
    unit_price: float
    barcode: str | None = None
    category: str | None = None
    is_available: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Endpoints ----------

@router.get("/{supplier_id}", response_model=list[CatalogItemResponse])
async def get_supplier_catalog(
    supplier_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get all catalog items for a supplier (visible to any merchant)."""
    # Verify supplier exists
    sup = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    if not sup.scalar_one_or_none():
        raise HTTPException(404, "Fournisseur introuvable")

    result = await db.execute(
        select(SupplierCatalogItem)
        .where(
            SupplierCatalogItem.supplier_id == supplier_id,
            SupplierCatalogItem.is_available == True,
        )
        .order_by(SupplierCatalogItem.name)
    )
    return result.scalars().all()


# NOTE: POST/PATCH/DELETE removed — only suppliers manage their own catalog
# via /supplier-portal/catalog endpoints. Merchants can only READ (GET above).
