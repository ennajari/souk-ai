from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from schemas.merchant import MerchantResponse, MerchantUpdate

router = APIRouter(prefix="/merchants", tags=["merchants"])


@router.get("/me", response_model=MerchantResponse)
async def get_profile(merchant: Annotated[Merchant, Depends(get_current_merchant)]):
    return merchant


@router.patch("/me", response_model=MerchantResponse)
async def update_profile(
    req: MerchantUpdate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(merchant, field, value)
    await db.commit()
    return merchant


@router.get("/me/export")
async def export_my_data(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Download all data held about this account as JSON (GDPR / loi 09-08 access & portability)."""
    from fastapi.responses import JSONResponse

    from services.data_export import export_merchant
    return JSONResponse(
        await export_merchant(db, merchant),
        headers={"Content-Disposition": 'attachment; filename="souk-ai-export.json"'},
    )


@router.get("/me/tax-rates")
async def my_tax_rates(merchant: Annotated[Merchant, Depends(get_current_merchant)]):
    """Suggested VAT rates for the merchant's country (defaults to pick from; never applied silently)."""
    from core.locale import get_country
    c = get_country(merchant.country_code)
    return {"country": c.code, "label": c.tax_label, "rates": list(c.vat_rates)}
