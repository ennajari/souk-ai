from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from services.credit_scoring import calculate_credit_score

router = APIRouter(prefix="/credit", tags=["credit"])


class CreditRequestBody(BaseModel):
    amount: float
    term_days: int
    fee_percentage: float

@router.get("/score")
async def get_score(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get the current dynamic credit score and its breakdown factors."""
    score_data = await calculate_credit_score(db, merchant.id)
    return score_data

# Loan offers used to be hard-coded mock amounts/fees shown to real merchants as if they were real.
# Lending is regulated: no offers until a licensed financing partner provides them (DECISIONS D13).
NO_PARTNER = "Le financement arrive bientôt avec un partenaire agréé. Votre score se construit dès maintenant."


@router.get("/offers")
async def get_offers(merchant: Annotated[Merchant, Depends(get_current_merchant)]):
    return {"eligibility": False, "offers": [], "message": NO_PARTNER}


@router.post("/request", status_code=410)
async def request_credit(merchant: Annotated[Merchant, Depends(get_current_merchant)]):
    raise HTTPException(410, NO_PARTNER)
