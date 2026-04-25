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
    await db.flush()
    return merchant
