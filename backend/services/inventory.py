import unicodedata

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionSource
from services.vector_db import search_similar_products


def _normalize(s: str) -> str:
    """Lowercase, strip accents: sucré → sucre, Café → cafe."""
    s = s.lower().strip()
    return ''.join(
        c for c in unicodedata.normalize('NFD', s)
        if unicodedata.category(c) != 'Mn'
    )


def _sig_words(s: str) -> set[str]:
    """Return significant words (len >= 3) from a normalized string."""
    return {w for w in _normalize(s).split() if len(w) >= 3}


async def _all_active_products(db: AsyncSession, merchant_id: str) -> list:
    result = await db.execute(
        select(Product).where(
            Product.merchant_id == merchant_id,
            Product.is_active == True,
        )
    )
    return result.scalars().all()


async def find_product_by_name(db: AsyncSession, merchant_id: str, name: str) -> Product | None:
    """Fuzzy search: vector → ILIKE → accent-normalized → word-level."""
    # 1. Vector DB semantic search
    try:
        results = await search_similar_products(name, merchant_id, limit=1)
        if results and results[0].get("certainty", 0) > 0.65:
            product_id = results[0]["product_id"]
            result = await db.execute(
                select(Product).where(
                    Product.id == product_id,
                    Product.merchant_id == merchant_id,
                    Product.is_active == True,
                )
            )
            prod = result.scalar_one_or_none()
            if prod:
                return prod
    except Exception as e:
        print(f"Vector search failed: {e}")

    # 2. ILIKE on exact name
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

    # 3. Product aliases
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

    # 4. Accent-normalized + word-level matching — with strict similarity thresholds
    all_products = await _all_active_products(db, merchant_id)
    name_norm = _normalize(name)
    name_words = _sig_words(name)

    for prod in all_products:
        pname_fr = _normalize(prod.name_fr or "")
        pname_ar = _normalize(prod.name_ar or "")

        for pname in [pname_fr, pname_ar]:
            if not pname:
                continue
            # Substring match: require the shorter string is ≥ 60% of the longer
            # "sucre" (5) in "bloc de sucre" (14) → 5/14=0.36 → SKIP (different products)
            # "coca-cola" (9) in "coca-cola pet 1l" (16) → 9/16=0.56 → SKIP
            # "sucre" (5) in "sucre" (5) → 5/5=1.0 → MATCH
            if name_norm == pname:
                return prod
            if name_norm in pname or pname in name_norm:
                shorter = min(len(name_norm), len(pname))
                longer = max(len(name_norm), len(pname))
                if longer > 0 and shorter / longer >= 0.65:
                    return prod

        # Word overlap: require majority of words match (>= 60%)
        # "Bloc de sucre" ∩ "sucré" = {"sucre"}, score = 1/2 = 0.5 → SKIP
        # "Coca-Cola" ∩ "Coca-Cola PET 1L" → depends on tokenization, will be caught by ILIKE above
        pwords = _sig_words((prod.name_fr or "") + " " + (prod.name_ar or ""))
        if name_words and pwords:
            common = name_words & pwords
            if common:
                score = len(common) / max(len(name_words), len(pwords))
                if score >= 0.6:
                    return prod

    return None


async def find_most_similar_product(
    db: AsyncSession, merchant_id: str, name: str
) -> tuple["Product | None", float]:
    """
    Return (best_product, score 0-1) — the closest product even when find_product_by_name fails.
    Score >= 0.4 means confident enough to auto-match.
    """
    all_products = await _all_active_products(db, merchant_id)
    if not all_products:
        return None, 0.0

    name_words = _sig_words(name)
    if not name_words:
        return None, 0.0

    best_score = 0.0
    best_prod = None

    for prod in all_products:
        pwords = _sig_words((prod.name_fr or "") + " " + (prod.name_ar or ""))
        if not pwords:
            continue
        common = name_words & pwords
        if not common:
            continue
        score = len(common) / max(len(name_words), len(pwords))
        if score > best_score:
            best_score = score
            best_prod = prod

    return best_prod, best_score


async def record_sale(
    db: AsyncSession, merchant_id: str, product_id: str, quantity: int, unit_price: float,
    source: TransactionSource = TransactionSource.WHATSAPP,
) -> Transaction:
    """WhatsApp/voice sale: same locked, stock-checked, journaled path as the POS.

    Raises services.sales.SaleError (e.g. not enough stock) — callers reply to the merchant with it.
    """
    from services.sales import Line, record_items
    [(txn, _)] = await record_items(db, merchant_id, [Line(
        product_id=product_id, quantity=int(quantity), unit_price=unit_price, source=source.value,
    )])
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
        .options(selectinload(Inventory.product))
    )
    items = result.scalars().all()
    low = []
    for i in items:
        if float(i.quantity) <= i.reorder_threshold:
            name = ""
            if i.product:
                name = i.product.name_fr or i.product.name_ar or ""
            low.append({
                "product_id": i.product_id,
                "product_name": name,
                "quantity": float(i.quantity),
                "threshold": i.reorder_threshold,
            })
    return low
