"""Grant (or revoke) the platform-admin flag. Admin rights are never derived from email/phone.

Usage (inside the backend container):
    python -m scripts.grant_admin 212600000000          # grant
    python -m scripts.grant_admin 212600000000 --revoke
"""
import asyncio
import sys

from sqlalchemy import update

from core.database import AsyncSessionLocal
from core.locale import normalize_phone
from models.merchant import Merchant


async def main(phone: str, grant: bool) -> None:
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            update(Merchant).where(Merchant.phone_number == normalize_phone(phone)).values(is_admin=grant)
        )
        await db.commit()
    print(f"{'granted' if grant else 'revoked'}: {res.rowcount} account(s)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    asyncio.run(main(sys.argv[1], "--revoke" not in sys.argv))
