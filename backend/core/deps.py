from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import decode_access_token
from models.merchant import Merchant, AccountType
from app.config import settings

security_scheme = HTTPBearer()


def check_is_admin(merchant: Merchant) -> bool:
    """Check if a merchant is the platform admin."""
    return (
        merchant.phone_number == settings.ADMIN_PHONE
        or (merchant.email and merchant.email == settings.ADMIN_EMAIL)
    )


async def get_current_merchant(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    merchant_id = decode_access_token(credentials.credentials)
    if not merchant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expire")

    result = await db.execute(select(Merchant).where(Merchant.id == merchant_id))
    merchant = result.scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Merchant introuvable")
    return merchant


async def get_current_supplier(
    merchant: Merchant = Depends(get_current_merchant),
) -> Merchant:
    if merchant.account_type != AccountType.SUPPLIER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces reserve aux fournisseurs")
    return merchant
