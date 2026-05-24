from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.deps import get_current_supplier
from models.merchant import Merchant, AccountType
from models.supplier import Supplier
from models.supplier_order import SupplierOrder, SupplierOrderStatus
from models.payment import Payment
from models.notification import Notification
from services.sse_events import subscribe, publish_event

router = APIRouter(prefix="/supplier-portal", tags=["Supplier Portal"])


class OrderStatusUpdate(BaseModel):
    status: str


async def _get_supplier_ids(db: AsyncSession, account_id: str) -> list[str]:
    result = await db.execute(
        select(Supplier.id).where(Supplier.supplier_account_id == account_id, Supplier.is_active == True)
    )
    return list(result.scalars().all())


@router.get("/dashboard")
async def supplier_dashboard(
    merchant: Annotated[Merchant, Depends(get_current_supplier)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    supplier_ids = await _get_supplier_ids(db, merchant.id)
    if not supplier_ids:
        return {"total_orders": 0, "pending": 0, "in_delivery": 0, "delivered": 0, "total_revenue": 0}

    orders_result = await db.execute(
        select(SupplierOrder).where(SupplierOrder.supplier_id.in_(supplier_ids))
    )
    orders = orders_result.scalars().all()

    total_revenue = 0
    payments_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.order_type == "supplier",
            Payment.order_id.in_([o.id for o in orders]),
            Payment.status == "COMPLETED",
        )
    )
    total_revenue = float(payments_result.scalar() or 0)

    return {
        "total_orders": len(orders),
        "pending": sum(1 for o in orders if o.status == SupplierOrderStatus.PENDING),
        "submitted": sum(1 for o in orders if o.status == SupplierOrderStatus.SUBMITTED),
        "in_delivery": sum(1 for o in orders if o.status == SupplierOrderStatus.IN_DELIVERY),
        "delivered": sum(1 for o in orders if o.status == SupplierOrderStatus.DELIVERED),
        "total_revenue": total_revenue,
    }


@router.get("/orders")
async def supplier_orders(
    merchant: Annotated[Merchant, Depends(get_current_supplier)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = None,
):
    supplier_ids = await _get_supplier_ids(db, merchant.id)
    if not supplier_ids:
        return []

    query = (
        select(SupplierOrder)
        .options(selectinload(SupplierOrder.supplier))
        .where(SupplierOrder.supplier_id.in_(supplier_ids))
    )
    if status:
        query = query.where(SupplierOrder.status == SupplierOrderStatus(status))
    query = query.order_by(SupplierOrder.created_at.desc())

    result = await db.execute(query)
    orders = result.scalars().all()

    # Batch fetch merchant names
    merchant_ids = list({o.merchant_id for o in orders if o.merchant_id})
    merchants_map = {}
    if merchant_ids:
        m_result = await db.execute(
            select(Merchant.id, Merchant.business_name).where(Merchant.id.in_(merchant_ids))
        )
        merchants_map = {r.id: r.business_name for r in m_result.all()}

    # Batch fetch payment statuses
    order_ids = [o.id for o in orders]
    payments_map = {}
    if order_ids:
        p_result = await db.execute(
            select(Payment).where(Payment.order_id.in_(order_ids), Payment.order_type == "supplier")
        )
        for p in p_result.scalars().all():
            payments_map[p.order_id] = {
                "id": p.id, "status": p.status.value if hasattr(p.status, 'value') else p.status,
                "method": p.method.value if hasattr(p.method, 'value') else p.method,
                "amount": float(p.amount),
            }

    return [
        {
            "id": o.id,
            "merchant_id": o.merchant_id,
            "merchant_name": merchants_map.get(o.merchant_id, "—"),
            "supplier_id": o.supplier_id,
            "status": o.status.value,
            "total_amount": float(o.total_amount),
            "items": o.items,
            "payment": payments_map.get(o.id),
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "submitted_at": o.submitted_at.isoformat() if o.submitted_at else None,
            "delivered_at": o.delivered_at.isoformat() if o.delivered_at else None,
        }
        for o in orders
    ]


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    data: OrderStatusUpdate,
    merchant: Annotated[Merchant, Depends(get_current_supplier)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    supplier_ids = await _get_supplier_ids(db, merchant.id)

    result = await db.execute(
        select(SupplierOrder).where(
            SupplierOrder.id == order_id,
            SupplierOrder.supplier_id.in_(supplier_ids),
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Commande introuvable")

    new_status = SupplierOrderStatus(data.status)

    # Validate transitions
    valid_transitions = {
        SupplierOrderStatus.SUBMITTED: [SupplierOrderStatus.IN_DELIVERY, SupplierOrderStatus.CANCELLED],
        SupplierOrderStatus.IN_DELIVERY: [SupplierOrderStatus.DELIVERED],
        SupplierOrderStatus.PENDING: [SupplierOrderStatus.SUBMITTED, SupplierOrderStatus.CANCELLED],
    }
    allowed = valid_transitions.get(order.status, [])
    if new_status not in allowed:
        raise HTTPException(400, f"Transition invalide: {order.status.value} → {new_status.value}")

    order.status = new_status
    now = datetime.now(timezone.utc)
    if new_status == SupplierOrderStatus.SUBMITTED:
        order.submitted_at = now
    elif new_status == SupplierOrderStatus.DELIVERED:
        order.delivered_at = now

    # Notify the merchant
    if order.merchant_id:
        status_labels = {
            "SUBMITTED": "confirmee",
            "IN_DELIVERY": "en cours de livraison",
            "DELIVERED": "livree",
            "CANCELLED": "annulee",
        }
        notif = Notification(
            merchant_id=order.merchant_id,
            type="delivery",
            title=f"Commande {status_labels.get(new_status.value, new_status.value)}",
            message=f"Commande #{order.id[:8].upper()} — {float(order.total_amount):.2f} MAD",
        )
        db.add(notif)

    await db.commit()

    # SSE push to merchant
    if order.merchant_id:
        try:
            await publish_event(f"merchant:{order.merchant_id}", "order_update", {
                "order_id": order.id,
                "new_status": new_status.value,
            })
        except Exception:
            pass

    return {"status": "ok", "new_status": new_status.value}


@router.get("/payments")
async def supplier_payments(
    merchant: Annotated[Merchant, Depends(get_current_supplier)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    supplier_ids = await _get_supplier_ids(db, merchant.id)
    if not supplier_ids:
        return []

    # Get all order IDs for this supplier
    orders_result = await db.execute(
        select(SupplierOrder.id, SupplierOrder.merchant_id).where(SupplierOrder.supplier_id.in_(supplier_ids))
    )
    order_rows = orders_result.all()
    order_ids = [r.id for r in order_rows]
    order_merchant_map = {r.id: r.merchant_id for r in order_rows}

    if not order_ids:
        return []

    payments_result = await db.execute(
        select(Payment).where(
            Payment.order_type == "supplier",
            Payment.order_id.in_(order_ids),
        ).order_by(Payment.created_at.desc())
    )
    payments = payments_result.scalars().all()

    # Batch fetch merchant names
    merchant_ids = list({order_merchant_map.get(p.order_id) for p in payments if order_merchant_map.get(p.order_id)})
    merchants_map = {}
    if merchant_ids:
        m_result = await db.execute(
            select(Merchant.id, Merchant.business_name).where(Merchant.id.in_(merchant_ids))
        )
        merchants_map = {r.id: r.business_name for r in m_result.all()}

    return [
        {
            "id": p.id,
            "order_id": p.order_id,
            "merchant_name": merchants_map.get(order_merchant_map.get(p.order_id), "—"),
            "method": p.method.value if hasattr(p.method, 'value') else p.method,
            "amount": float(p.amount),
            "status": p.status.value if hasattr(p.status, 'value') else p.status,
            "external_ref": p.external_ref,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payments
    ]


# ---------- Catalogue Management ----------

@router.get("/catalog")
async def get_my_catalog(
    merchant: Annotated[Merchant, Depends(get_current_supplier)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get all catalog items for the supplier's linked supplier records."""
    from models.supplier_catalog import SupplierCatalogItem
    supplier_ids = await _get_supplier_ids(db, merchant.id)
    if not supplier_ids:
        return []
    result = await db.execute(
        select(SupplierCatalogItem)
        .where(SupplierCatalogItem.supplier_id.in_(supplier_ids), SupplierCatalogItem.is_available == True)
        .order_by(SupplierCatalogItem.name)
    )
    items = result.scalars().all()
    return [
        {
            "id": i.id, "supplier_id": i.supplier_id, "name": i.name,
            "unit": i.unit, "unit_price": float(i.unit_price),
            "barcode": i.barcode, "category": i.category,
            "is_available": i.is_available,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in items
    ]


class CatalogItemInput(BaseModel):
    name: str
    unit: str = "piece"
    unit_price: float = 0
    barcode: str | None = None
    category: str | None = None


@router.post("/catalog", status_code=201)
async def add_catalog_item(
    data: CatalogItemInput,
    merchant: Annotated[Merchant, Depends(get_current_supplier)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Add item to supplier's catalog."""
    from models.supplier_catalog import SupplierCatalogItem
    supplier_ids = await _get_supplier_ids(db, merchant.id)
    if not supplier_ids:
        raise HTTPException(400, "Aucun fournisseur lie a votre compte")
    # Use first linked supplier
    item = SupplierCatalogItem(
        supplier_id=supplier_ids[0],
        name=data.name, unit=data.unit, unit_price=data.unit_price,
        barcode=data.barcode, category=data.category,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {
        "id": item.id, "supplier_id": item.supplier_id, "name": item.name,
        "unit": item.unit, "unit_price": float(item.unit_price),
        "barcode": item.barcode, "category": item.category,
        "is_available": item.is_available,
    }


@router.patch("/catalog/{item_id}")
async def update_catalog_item(
    item_id: str,
    data: CatalogItemInput,
    merchant: Annotated[Merchant, Depends(get_current_supplier)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a catalog item."""
    from models.supplier_catalog import SupplierCatalogItem
    supplier_ids = await _get_supplier_ids(db, merchant.id)
    result = await db.execute(
        select(SupplierCatalogItem).where(
            SupplierCatalogItem.id == item_id,
            SupplierCatalogItem.supplier_id.in_(supplier_ids),
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Article introuvable")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    return {
        "id": item.id, "supplier_id": item.supplier_id, "name": item.name,
        "unit": item.unit, "unit_price": float(item.unit_price),
        "barcode": item.barcode, "category": item.category,
        "is_available": item.is_available,
    }


@router.delete("/catalog/{item_id}", status_code=204)
async def delete_catalog_item(
    item_id: str,
    merchant: Annotated[Merchant, Depends(get_current_supplier)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Remove item from catalog (soft delete)."""
    from models.supplier_catalog import SupplierCatalogItem
    supplier_ids = await _get_supplier_ids(db, merchant.id)
    result = await db.execute(
        select(SupplierCatalogItem).where(
            SupplierCatalogItem.id == item_id,
            SupplierCatalogItem.supplier_id.in_(supplier_ids),
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Article introuvable")
    item.is_available = False
    await db.commit()


@router.get("/events")
async def supplier_events(
    request: Request,
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """SSE endpoint — uses token query param because EventSource doesn't support headers."""
    from core.security import decode_access_token

    merchant_id = decode_access_token(token)
    if not merchant_id:
        raise HTTPException(401, "Token invalide")
    result = await db.execute(select(Merchant).where(Merchant.id == merchant_id))
    merchant = result.scalar_one_or_none()
    if not merchant or merchant.account_type != AccountType.SUPPLIER:
        raise HTTPException(403, "Acces reserve aux fournisseurs")

    async def stream():
        async for chunk in subscribe(f"supplier:{merchant.id}"):
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
