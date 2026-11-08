from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import decode_token
from models.merchant import AccountType, Merchant

security_scheme = HTTPBearer()
optional_security_scheme = HTTPBearer(auto_error=False)


def check_is_admin(merchant: Merchant) -> bool:
    """Admin = server-side DB flag. Never derived from user-editable fields (email/phone)."""
    return bool(merchant.is_admin)


async def merchant_from_token(token: str, db: AsyncSession) -> Merchant | None:
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        return None
    merchant = (await db.execute(select(Merchant).where(Merchant.id == payload["sub"]))).scalar_one_or_none()
    if not merchant or payload.get("ver", 0) != (merchant.token_version or 0):
        return None
    return merchant


async def get_current_merchant(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    merchant = await merchant_from_token(credentials.credentials, db)
    if not merchant:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expire")
    return merchant


async def get_optional_merchant(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Merchant | None:
    """For public endpoints that unlock extra actions when the shop owner is logged in."""
    if not credentials:
        return None
    return await merchant_from_token(credentials.credentials, db)


async def get_current_supplier(
    merchant: Merchant = Depends(get_current_merchant),
) -> Merchant:
    if merchant.account_type != AccountType.SUPPLIER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces reserve aux fournisseurs")
    return merchant
