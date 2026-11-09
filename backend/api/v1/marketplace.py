from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.marketplace import (
    MarketplaceListing, ListingStatus,
    MarketplaceOrder, MarketplaceOrderStatus,
)
from schemas.marketplace import (
    ListingCreate, ListingUpdate, ListingResponse,
    MarketplaceOrderCreate, MarketplaceOrderResponse, OrderStatusUpdate,
)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


# ─── Listings ───

@router.get("/listings")
async def browse_listings(
    category: str = None,
    city: str = None,
    search: str = None,
    min_price: float = None,
    max_price: float = None,
    page: int = 1,
    limit: int = 20,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    merchant: Annotated[Merchant, Depends(get_current_merchant)] = None,
):
    """Browse all active marketplace listings (excludes own)."""
    q = select(MarketplaceListing).where(
        MarketplaceListing.status == ListingStatus.ACTIVE,
        MarketplaceListing.merchant_id != merchant.id,
    )
    if category:
        q = q.where(MarketplaceListing.category == category)
    if city:
        q = q.where(MarketplaceListing.city == city)
    if search:
        q = q.where(MarketplaceListing.title.ilike(f"%{search}%"))
    if min_price is not None:
        q = q.where(MarketplaceListing.unit_price >= min_price)
    if max_price is not None:
        q = q.where(MarketplaceListing.unit_price <= max_price)

    # Count total
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(MarketplaceListing.created_at.desc())
    q = q.offset((page - 1) * limit).limit(limit)
    result = await db.execute(q)
    listings = result.scalars().all()

    # Batch fetch seller names in one query
    seller_ids = [listing.merchant_id for listing in listings]
    sellers_map: dict = {}
    if seller_ids:
        s_rows = (await db.execute(
            select(Merchant.id, Merchant.business_name).where(Merchant.id.in_(seller_ids))
        )).all()
        sellers_map = {r.id: r.business_name for r in s_rows}

    items = [
        {
            **ListingResponse.model_validate(listing_item).model_dump(),
            "seller_name": sellers_map.get(listing_item.merchant_id, "—"),
        }
        for listing_item in listings
    ]

    return {"items": items, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/my-listings")
async def my_listings(
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Get merchant's own listings."""
    q = await db.execute(
        select(MarketplaceListing)
        .where(MarketplaceListing.merchant_id == merchant.id)
        .order_by(MarketplaceListing.created_at.desc())
    )
    return [ListingResponse.model_validate(listing_item).model_dump() for listing_item in q.scalars().all()]


@router.post("/listings", response_model=ListingResponse)
async def create_listing(
    data: ListingCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Create a new marketplace listing."""
    listing = MarketplaceListing(
        merchant_id=merchant.id,
        product_id=data.product_id,
        title=data.title,
        description=data.description,
        category=data.category,
        unit_price=data.unit_price,
        min_quantity=data.min_quantity,
        available_quantity=data.available_quantity,
        unit=data.unit,
        city=data.city,
        delivery_zones=data.delivery_zones,
    )
    db.add(listing)
    await db.commit()
    await db.refresh(listing)
    return ListingResponse.model_validate(listing)


@router.patch("/listings/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: str,
    data: ListingUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Update own listing."""
    result = await db.execute(
        select(MarketplaceListing).where(
            MarketplaceListing.id == listing_id,
            MarketplaceListing.merchant_id == merchant.id,
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(404, "Annonce introuvable")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = ListingStatus(update_data["status"])

    for key, value in update_data.items():
        setattr(listing, key, value)

    await db.commit()
    await db.refresh(listing)
    return ListingResponse.model_validate(listing)


@router.delete("/listings/{listing_id}", status_code=204)
async def delete_listing(
    listing_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Delete own listing."""
    result = await db.execute(
        select(MarketplaceListing).where(
            MarketplaceListing.id == listing_id,
            MarketplaceListing.merchant_id == merchant.id,
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(404, "Annonce introuvable")
    await db.delete(listing)
    await db.commit()


# ─── Orders ───

@router.post("/orders", response_model=MarketplaceOrderResponse)
async def create_order(
    data: MarketplaceOrderCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Place an order on a marketplace listing."""
    # Lock the listing: two buyers can't both take the last units
    listing_q = await db.execute(
        select(MarketplaceListing).where(MarketplaceListing.id == data.listing_id).with_for_update().execution_options(populate_existing=True)
    )
    listing = listing_q.scalar_one_or_none()
    if not listing:
        raise HTTPException(404, "Annonce introuvable")
    if listing.merchant_id == merchant.id:
        raise HTTPException(400, "Vous ne pouvez pas acheter votre propre annonce")
    if listing.status != ListingStatus.ACTIVE:
        raise HTTPException(400, "Annonce non disponible")
    if data.quantity < listing.min_quantity:
        raise HTTPException(400, f"Quantite minimum: {listing.min_quantity}")
    if data.quantity > listing.available_quantity:
        raise HTTPException(400, f"Stock disponible: {listing.available_quantity}")

    total = data.quantity * float(listing.unit_price)

    order = MarketplaceOrder(
        listing_id=listing.id,
        buyer_id=merchant.id,
        seller_id=listing.merchant_id,
        quantity=data.quantity,
        unit_price=float(listing.unit_price),
        total_amount=total,
        delivery_address=data.delivery_address,
        notes=data.notes,
    )
    db.add(order)

    # Reduce available quantity
    listing.available_quantity -= data.quantity
    if listing.available_quantity <= 0:
        listing.status = ListingStatus.SOLD

    await db.commit()
    await db.refresh(order)

    return _enrich_order(order, listing.title, merchant.business_name, None)


@router.get("/orders/buying")
async def my_buying_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Orders where I am the buyer."""
    q = await db.execute(
        select(MarketplaceOrder)
        .where(MarketplaceOrder.buyer_id == merchant.id)
        .order_by(MarketplaceOrder.created_at.desc())
    )
    orders = q.scalars().all()
    return await _batch_load_orders(db, orders)


@router.get("/orders/selling")
async def my_selling_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Orders where I am the seller."""
    q = await db.execute(
        select(MarketplaceOrder)
        .where(MarketplaceOrder.seller_id == merchant.id)
        .order_by(MarketplaceOrder.created_at.desc())
    )
    orders = q.scalars().all()
    return await _batch_load_orders(db, orders)


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    data: OrderStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
):
    """Update order status following an explicit state machine (see _TRANSITIONS)."""
    order = (await db.execute(
        select(MarketplaceOrder).where(MarketplaceOrder.id == order_id).with_for_update().execution_options(populate_existing=True)
    )).scalar_one_or_none()
    if not order or merchant.id not in (order.seller_id, order.buyer_id):
        raise HTTPException(404, "Commande introuvable")

    new_status = MarketplaceOrderStatus(data.status)
    role = "seller" if merchant.id == order.seller_id else "buyer"
    if new_status not in _TRANSITIONS.get((order.status, role), ()):
        raise HTTPException(
            409, f"Transition impossible: {order.status.value} → {new_status.value} ({'vendeur' if role == 'seller' else 'acheteur'})"
        )
    order.status = new_status

    # Release the reserved quantity exactly once: CANCELLED is terminal
    if new_status == MarketplaceOrderStatus.CANCELLED:
        listing = (await db.execute(
            select(MarketplaceListing).where(MarketplaceListing.id == order.listing_id).with_for_update().execution_options(populate_existing=True)
        )).scalar_one_or_none()
        if listing:
            listing.available_quantity += order.quantity
            if listing.status == ListingStatus.SOLD:
                listing.status = ListingStatus.ACTIVE

    await db.commit()
    return await _load_order_details(db, order)


S = MarketplaceOrderStatus
# (current status, who) → allowed next statuses. DELIVERED and CANCELLED are terminal.
# Before: any party could set almost any status at any time — e.g. cancel a delivered order (or the
# same order twice) and put its quantity back on sale each time.
_TRANSITIONS = {
    (S.PENDING, "seller"): (S.ACCEPTED, S.CANCELLED),
    (S.PENDING, "buyer"): (S.CANCELLED,),
    (S.ACCEPTED, "seller"): (S.SHIPPED, S.CANCELLED),
    (S.ACCEPTED, "buyer"): (S.CANCELLED,),
    (S.SHIPPED, "buyer"): (S.DELIVERED, S.DISPUTED),
    (S.DISPUTED, "buyer"): (S.DELIVERED,),
}


# ─── Helpers ───

async def _batch_load_orders(db: AsyncSession, orders: list[MarketplaceOrder]) -> list[dict]:
    """Load order details in batch (avoids N+1 queries)."""
    if not orders:
        return []

    # Batch fetch listing titles
    listing_ids = list({o.listing_id for o in orders})
    listing_rows = (await db.execute(
        select(MarketplaceListing.id, MarketplaceListing.title).where(MarketplaceListing.id.in_(listing_ids))
    )).all()
    listings_map = {r.id: r.title for r in listing_rows}

    # Batch fetch merchant names (buyers + sellers)
    merchant_ids = list({o.buyer_id for o in orders} | {o.seller_id for o in orders})
    merchant_rows = (await db.execute(
        select(Merchant.id, Merchant.business_name).where(Merchant.id.in_(merchant_ids))
    )).all()
    merchants_map = {r.id: r.business_name for r in merchant_rows}

    return [
        _enrich_order(o, listings_map.get(o.listing_id), merchants_map.get(o.buyer_id), merchants_map.get(o.seller_id))
        for o in orders
    ]


async def _load_order_details(db: AsyncSession, order: MarketplaceOrder) -> dict:
    """Load single order details (used for single order status updates)."""
    results = await _batch_load_orders(db, [order])
    return results[0] if results else {}


def _enrich_order(order, listing_title, buyer_name, seller_name) -> dict:
    return {
        "id": order.id,
        "listing_id": order.listing_id,
        "buyer_id": order.buyer_id,
        "seller_id": order.seller_id,
        "quantity": order.quantity,
        "unit_price": float(order.unit_price),
        "total_amount": float(order.total_amount),
        "status": order.status.value if hasattr(order.status, 'value') else order.status,
        "delivery_address": order.delivery_address,
        "notes": order.notes,
        "payment_id": order.payment_id,
        "listing_title": listing_title,
        "buyer_name": buyer_name,
        "seller_name": seller_name,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }
