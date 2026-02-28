from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.product import Product
from models.inventory import Inventory
from services.forecasting import calculate_forecast, get_restock_recommendations
from schemas.forecast import ProductForecast, ForecastPoint

router = APIRouter(prefix="/forecasts", tags=["Forecasts"])


@router.get("/", response_model=list[ProductForecast])
async def list_forecasts(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """Get 7-day demand forecasts and restock recommendations for all products."""
    return await get_restock_recommendations(db, merchant.id)


@router.get("/{product_id}", response_model=ProductForecast)
async def get_product_forecast(
    product_id: str,
    days: int = 7,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed demand forecast for a specific product."""
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.merchant_id == merchant.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    inv_result = await db.execute(select(Inventory).where(Inventory.product_id == product_id))
    inv = inv_result.scalar_one_or_none()
    current_stock = float(inv.quantity) if inv else 0.0
    threshold = inv.reorder_threshold if inv else 10

    forecast_list = await calculate_forecast(db, merchant.id, product_id, days)
    total_demand = sum(f["demand"] for f in forecast_list)
    restock = max(0, int(total_demand - current_stock + threshold + 0.5))

    return ProductForecast(
        product_id=product.id,
        product_name_ar=product.name_ar,
        product_name_fr=product.name_fr or "",
        current_stock=current_stock,
        predicted_demand_7d=round(total_demand, 2),
        restock_quantity=restock,
        forecast=[ForecastPoint(**fp) for fp in forecast_list],
    )
