from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from services.credit_scoring import calculate_credit_score

router = APIRouter(prefix="/credit", tags=["credit"])

@router.get("/score")
async def get_score(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """Get the current dynamic credit score and its breakdown factors."""
    score_data = await calculate_credit_score(db, merchant.id)
    return score_data

@router.get("/offers")
async def get_offers(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    """Return mock working capital loan offers based on credit score."""
    score_data = await calculate_credit_score(db, merchant.id)
    score = score_data["score"]
    
    offers = []
    if score >= 600:
        offers.append({"amount": 5000, "term_days": 30, "fee_percentage": 2.5})
    if score >= 750:
        offers.append({"amount": 15000, "term_days": 60, "fee_percentage": 2.0})
    if score >= 900:
        offers.append({"amount": 50000, "term_days": 90, "fee_percentage": 1.5})
        
    return {
        "eligibility": len(offers) > 0,
        "offers": offers
    }
