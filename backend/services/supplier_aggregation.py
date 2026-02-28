from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from models.supplier import Supplier
from models.supplier_order import SupplierOrder, SupplierOrderStatus
from models.merchant import Merchant

async def aggregate_supplier_orders(db: AsyncSession, supplier_id: str) -> list[SupplierOrder]:
    """
    Finds all DRAFT or PENDING orders for a given supplier and aggregates their items.
    Note: In this MVP iteration, we just return the pending orders. For a real aggregation,
    we would group similar items from multiple merchants into a unified bulk purchase.
    """
    result = await db.execute(
        select(SupplierOrder).where(
            SupplierOrder.supplier_id == supplier_id,
            SupplierOrder.status.in_([SupplierOrderStatus.PENDING])
        )
    )
    return result.scalars().all()

async def create_aggregated_bulk_order(db: AsyncSession, supplier_id: str) -> dict:
    """
    1. Grabs all pending orders for this supplier.
    2. Sums up the required quantities for each product.
    3. Returns a snapshot of what needs to be ordered.
    4. Marks orders as SUBMITTED.
    """
    pending_orders = await aggregate_supplier_orders(db, supplier_id)
    if not pending_orders:
        return {"status": "no_orders", "aggregated_items": {}}
        
    aggregated = {}
    total_bulk_amount = 0.0
    
    for order in pending_orders:
        for item in order.items:
            pid = item.get("product_id")
            if pid not in aggregated:
                aggregated[pid] = {
                    "product_name": item.get("product_name"),
                    "total_quantity": 0,
                    "unit_price": item.get("unit_price")
                }
            aggregated[pid]["total_quantity"] += item.get("quantity", 0)
        
        order.status = SupplierOrderStatus.SUBMITTED
        order.submitted_at = datetime.now(timezone.utc)
        total_bulk_amount += float(order.total_amount)
        
    await db.commit()
    
    return {
        "status": "success",
        "supplier_id": supplier_id,
        "total_amount": total_bulk_amount,
        "order_count": len(pending_orders),
        "aggregated_items": aggregated
    }
