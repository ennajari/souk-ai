from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionType, TransactionSource
from services.vector_db import search_similar_products

async def find_product_by_name(db: AsyncSession, merchant_id: str, name: str) -> Product | None:
    """Fuzzy search for a product by Arabic or French name, enhanced with Vector DB."""
    # 1. Try vector DB first for semantic search
    try:
        results = await search_similar_products(name, merchant_id, limit=1)
        if results and results[0].get("certainty", 0) > 0.75:
            product_id = results[0]["product_id"]
            result = await db.execute(
                select(Product).where(
                    Product.id == product_id,
                    Product.merchant_id == merchant_id,
                    Product.is_active == True
                )
            )
            prod = result.scalar_one_or_none()
            if prod:
                return prod
    except Exception as e:
        print(f"Vector search failed, falling back to ILIKE: {e}")

    # 2. Fallback to exact ILIKE match
    result = await db.execute(
        select(Product).where(
            Product.merchant_id == merchant_id,
            Product.is_active == True,
            (Product.name_ar.ilike(f"%{name}%")) | (Product.name_fr.ilike(f"%{name}%")),
        )
    )
    found = result.scalars().first()
    if found:
        return found

    # 3. Try product aliases (tomates = طماطم etc.)
    try:
        from services.product_aliases import get_all_aliases
        aliases = get_all_aliases(name)
        for alias in aliases:
            if alias.lower() == name.lower():
                continue
            r = await db.execute(
                select(Product).where(
                    Product.merchant_id == merchant_id,
                    Product.is_active == True,
                    (Product.name_ar.ilike(f"%{alias}%")) | (Product.name_fr.ilike(f"%{alias}%")),
                )
            )
            p = r.scalars().first()
            if p:
                return p
    except Exception:
        pass

    return None


async def record_sale(
    db: AsyncSession, merchant_id: str, product_id: str, quantity: int, unit_price: float,
    source: TransactionSource = TransactionSource.WHATSAPP,
) -> Transaction:
    """Record a sale and update inventory."""
    txn = Transaction(
        merchant_id=merchant_id,
        product_id=product_id,
        type=TransactionType.SALE,
        source=source,
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
