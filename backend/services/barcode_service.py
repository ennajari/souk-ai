"""Global Barcode Intelligence Service.

When a merchant adds a product with a barcode, we store it globally.
When another merchant adds the same barcode, we auto-fill the product info.
"""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.global_barcode import GlobalBarcode


async def register_barcode(
    db: AsyncSession,
    barcode: str,
    name_fr: str | None = None,
    name_ar: str | None = None,
    unit: str = "piece",
    unit_price: float = 0,
    category: str | None = None,
) -> None:
    """Register or update a barcode in the global database."""
    if not barcode or not barcode.strip():
        return

    result = await db.execute(
        select(GlobalBarcode).where(GlobalBarcode.barcode == barcode)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Update with new info (majority vote / latest wins for names)
        existing.report_count += 1
        if name_fr and not existing.name_fr:
            existing.name_fr = name_fr
        if name_ar and not existing.name_ar:
            existing.name_ar = name_ar
        if unit_price > 0:
            # Running average price
            existing.avg_price = round(
                (float(existing.avg_price) * (existing.report_count - 1) + unit_price) / existing.report_count,
                2,
            )
        if category and not existing.category:
            existing.category = category
        existing.updated_at = datetime.now(timezone.utc)
    else:
        entry = GlobalBarcode(
            barcode=barcode,
            name_fr=name_fr,
            name_ar=name_ar,
            unit=unit,
            category=category,
            avg_price=unit_price,
            report_count=1,
        )
        db.add(entry)


async def lookup_barcode(db: AsyncSession, barcode: str) -> dict | None:
    """Lookup a barcode in the global database. Returns product info or None."""
    if not barcode or not barcode.strip():
        return None

    result = await db.execute(
        select(GlobalBarcode).where(GlobalBarcode.barcode == barcode)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return None

    return {
        "barcode": entry.barcode,
        "name_fr": entry.name_fr,
        "name_ar": entry.name_ar,
        "unit": entry.unit,
        "category": entry.category,
        "avg_price": float(entry.avg_price),
        "report_count": entry.report_count,
    }
