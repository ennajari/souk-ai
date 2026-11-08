"""The single place where sales, returns and purchases move stock (POS, WhatsApp bot, supplier deliveries)."""
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.money import to_money
from models.inventory import Inventory, InventoryLog
from models.product import Product
from models.transaction import Transaction, TransactionSource, TransactionType

_STOCK_IN = {"PURCHASE", "RETURN"}


class SaleError(Exception):
    """Business refusal (unknown product, not enough stock…). `status` maps to HTTP for the API."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message, self.status = message, status


@dataclass
class Line:
    product_id: str
    quantity: int
    unit_price: object
    type: str = "SALE"
    source: str = "WEB"
    customer_id: str | None = None
    unit_cost: object = None  # None → product's current cost_price


async def record_items(
    db: AsyncSession, merchant_id: str, items: list, customer_id: str | None = None,
) -> list[tuple[Transaction, Product]]:
    """Create transactions, move stock and write the stock journal, atomically (caller commits).

    Inventory rows are locked FOR UPDATE in product-id order: two tills (or the till and the
    WhatsApp bot) can't both sell the last unit, and lock order prevents deadlocks.
    """
    for item in items:
        if item.quantity <= 0:
            raise SaleError("La quantite doit etre positive", 422)
    product_ids = sorted({i.product_id for i in items})
    products = {p.id: p for p in (await db.execute(
        select(Product).where(Product.id.in_(product_ids), Product.merchant_id == merchant_id)
    )).scalars().all()}
    inv_map = {i.product_id: i for i in (await db.execute(
        select(Inventory).where(Inventory.product_id.in_(product_ids))
        .order_by(Inventory.product_id).with_for_update()
    )).scalars().all()}

    wanted: dict[str, int] = defaultdict(int)
    for item in items:
        if item.product_id not in products:
            raise SaleError(f"Produit introuvable: {item.product_id}", 404)
        if item.type == "SALE":
            wanted[item.product_id] += item.quantity
    for pid, qty in wanted.items():
        inv = inv_map.get(pid)
        if inv and to_money(inv.quantity) < qty:
            p = products[pid]
            raise SaleError(
                f"Stock insuffisant pour {p.name_fr or p.name_ar} — disponible: {float(inv.quantity):g}, demandé: {qty}"
            )

    now = datetime.now(timezone.utc)
    out = []
    for item in items:
        product = products[item.product_id]
        unit_price = to_money(item.unit_price)
        cost = getattr(item, "unit_cost", None)
        txn = Transaction(
            merchant_id=merchant_id, product_id=item.product_id,
            customer_id=customer_id or item.customer_id,
            type=TransactionType(item.type), source=TransactionSource(item.source),
            quantity=item.quantity, unit_price=unit_price, total_amount=to_money(unit_price * item.quantity),
            # frozen at sale time: later cost changes must not rewrite past margins
            unit_cost=to_money(cost if cost is not None else product.cost_price),
        )
        db.add(txn)
        out.append((txn, product))
        inv = inv_map.get(item.product_id)
        if inv and item.type in ("SALE", *_STOCK_IN):
            before = to_money(inv.quantity)
            change = -item.quantity if item.type == "SALE" else item.quantity
            inv.quantity = before + change
            inv.updated_at = now
            db.add(InventoryLog(
                product_id=item.product_id, merchant_id=merchant_id, quantity_before=before,
                quantity_change=change, quantity_after=inv.quantity, source=item.type.lower(),
                reason={"SALE": "Vente", "RETURN": "Retour client", "PURCHASE": "Achat / livraison"}[item.type],
            ))
    await db.flush()
    return out
