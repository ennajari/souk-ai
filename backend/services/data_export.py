"""Right of access / portability (GDPR art. 15 & 20, Moroccan law 09-08): everything we hold on a merchant."""
from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import Base
from models.customer import CreditEntry, Customer
from models.inventory import Inventory
from models.product import Product

# Credentials and internal counters are never exported
_SECRET_COLUMNS = {"hashed_password", "pin_hash", "pin_code", "token_version"}


def _row(obj) -> dict:
    out = {}
    for col in obj.__table__.columns:
        if col.name in _SECRET_COLUMNS:
            continue
        v = getattr(obj, col.key)
        if isinstance(v, Decimal):
            v = float(v)
        elif isinstance(v, (datetime, date)):
            v = v.isoformat()
        elif isinstance(v, Enum):
            v = v.value
        out[col.name] = v
    return out


async def export_merchant(db: AsyncSession, merchant) -> dict:
    data: dict = {"format": "souk-ai-export/1", "exported_at": datetime.now().isoformat(),
                  "merchant": _row(merchant)}
    for mapper in sorted(Base.registry.mappers, key=lambda m: m.class_.__tablename__):
        cls = mapper.class_
        if "merchant_id" in cls.__table__.columns and cls.__tablename__ != "idempotency_keys":
            rows = (await db.execute(select(cls).where(cls.merchant_id == merchant.id))).scalars().all()
            data[cls.__tablename__] = [_row(r) for r in rows]
    # Child tables keyed by their parent, not by merchant_id
    product_ids = select(Product.id).where(Product.merchant_id == merchant.id)
    data["inventory"] = [_row(r) for r in (await db.execute(
        select(Inventory).where(Inventory.product_id.in_(product_ids)))).scalars().all()]
    customer_ids = select(Customer.id).where(Customer.merchant_id == merchant.id)
    data["credit_entries"] = [_row(r) for r in (await db.execute(
        select(CreditEntry).where(CreditEntry.customer_id.in_(customer_ids)))).scalars().all()]
    return data
