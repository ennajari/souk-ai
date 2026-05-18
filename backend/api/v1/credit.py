from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.credit_request import CreditRequest, CreditRequestStatus
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

@router.get("/offers")
async def get_offers(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
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


@router.post("/request", status_code=201)
async def request_credit(
    body: CreditRequestBody,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit a credit request for a specific offer."""
    # Re-calculate credit score to verify eligibility
    score_data = await calculate_credit_score(db, merchant.id)
    score = score_data["score"]

    # Build the same offers list to validate the request
    valid_offers = []
    if score >= 600:
        valid_offers.append({"amount": 5000, "term_days": 30, "fee_percentage": 2.5})
    if score >= 750:
        valid_offers.append({"amount": 15000, "term_days": 60, "fee_percentage": 2.0})
    if score >= 900:
        valid_offers.append({"amount": 50000, "term_days": 90, "fee_percentage": 1.5})

    # Verify the requested offer matches an eligible one
    matching = any(
        o["amount"] == body.amount
        and o["term_days"] == body.term_days
        and o["fee_percentage"] == body.fee_percentage
        for o in valid_offers
    )
    if not matching:
        raise HTTPException(
            status_code=400,
            detail="Vous n'etes pas eligible a cette offre de credit",
        )

    credit_request = CreditRequest(
        merchant_id=merchant.id,
        amount=body.amount,
        term_days=body.term_days,
        fee_percentage=body.fee_percentage,
        status=CreditRequestStatus.PENDING,
    )
    db.add(credit_request)
    await db.commit()
    await db.refresh(credit_request)

    return {
        "id": credit_request.id,
        "status": credit_request.status.value,
        "amount": float(credit_request.amount),
        "term_days": credit_request.term_days,
        "fee_percentage": float(credit_request.fee_percentage),
    }
