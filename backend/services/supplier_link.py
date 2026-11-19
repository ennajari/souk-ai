"""A shop's supplier record <-> the wholesaler's own Souk.AI account, matched by phone number.

Once linked, the wholesaler sees that shop's orders in the supplier portal and the shop sees the
wholesaler's catalogue. The link is made from either side: whichever arrives second.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.locale import normalize_phone
from models.merchant import AccountType, Merchant
from models.supplier import Supplier


async def link_supplier(db: AsyncSession, supplier: Supplier, shop_country: str | None) -> None:
    """Point this shop's record at the wholesaler account with the same number (or at nothing)."""
    supplier.supplier_account_id = None
    if supplier.phone_number:
        phone = normalize_phone(supplier.phone_number, shop_country)  # the shop typed it in its own country format
        supplier.supplier_account_id = (await db.execute(
            select(Merchant.id).where(Merchant.phone_number == phone, Merchant.account_type == AccountType.SUPPLIER)
        )).scalar_one_or_none()


async def link_new_account(db: AsyncSession, account: Merchant) -> int:
    """A wholesaler just signed up: attach every shop record that already has their number."""
    # shortcut: scans unlinked supplier rows in Python; store a normalized phone column past ~100k rows
    rows = await db.execute(
        select(Supplier, Merchant.country_code)
        .join(Merchant, Merchant.id == Supplier.merchant_id)
        .where(Supplier.phone_number.isnot(None), Supplier.is_active == True,
               Supplier.supplier_account_id.is_(None))
    )
    linked = 0
    for sup, country in rows.all():
        if normalize_phone(sup.phone_number, country) == account.phone_number:
            sup.supplier_account_id = account.id
            linked += 1
    return linked


async def catalogue_supplier_ids(db: AsyncSession, supplier: Supplier) -> list[str]:
    """Catalogue items are filed under one of the wholesaler's records; every shop linked to that
    wholesaler must see them, so look across all records of the same account."""
    if not supplier.supplier_account_id:
        return [supplier.id]
    return list((await db.execute(
        select(Supplier.id).where(Supplier.supplier_account_id == supplier.supplier_account_id)
    )).scalars().all())
