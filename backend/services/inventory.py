from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionType, TransactionSource


async def find_product_by_name(db: AsyncSession, merchant_id: str, name: str) -> Product | None:
    """Fuzzy search for a product by Arabic or French name."""
    # Exact match first
    result = await db.execute(
        select(Product).where(
            Product.merchant_id == merchant_id,
            Product.is_active == True,
            (Product.name_ar.ilike(f"%{name}%")) | (Product.name_fr.ilike(f"%{name}%")),
        )
    )
    return result.scalar_one_or_none()


async def record_sale(
    db: AsyncSession, merchant_id: str, product_id: str, quantity: int, unit_price: float
) -> Transaction:
    """Record a sale and update inventory."""
    txn = Transaction(
        merchant_id=merchant_id,
        product_id=product_id,
        type=TransactionType.SALE,
        source=TransactionSource.WHATSAPP,
        quantity=quantity,
        unit_price=unit_price,
        total_amount=quantity * unit_price,
    )
    db.add(txn)

    # Update inventory
    inv_result = await db.execute(select(Inventory).where(Inventory.product_id == product_id))
    inv = inv_result.scalar_one_or_none()
    if inv:
        inv.quantity = float(inv.quantity) - quantity
        inv.updated_at = datetime.now(timezone.utc)

    await db.flush()
    return txn


async def get_stock_level(db: AsyncSession, product_id: str) -> float | None:
    """Get current stock level for a product."""
    result = await db.execute(select(Inventory).where(Inventory.product_id == product_id))
    inv = result.scalar_one_or_none()
    return float(inv.quantity) if inv else None


async def get_low_stock_products(db: AsyncSession, merchant_id: str) -> list[dict]:
    """Get products with stock below reorder threshold."""
    result = await db.execute(
        select(Inventory)
        .join(Product)
        .where(Product.merchant_id == merchant_id, Product.is_active == True)
    )
    items = result.scalars().all()
    low = []
    for i in items:
        if float(i.quantity) <= i.reorder_threshold:
            low.append({
                "product_id": i.product_id,
                "product_name": i.product.name_ar if i.product else "",
                "quantity": float(i.quantity),
                "threshold": i.reorder_threshold,
            })
    return low
