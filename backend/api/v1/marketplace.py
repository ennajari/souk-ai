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
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
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

    items = []
    for l in listings:
        seller_q = await db.execute(select(Merchant.business_name).where(Merchant.id == l.merchant_id))
        seller_name = seller_q.scalar()
        items.append({
            **ListingResponse.model_validate(l).model_dump(),
            "seller_name": seller_name,
        })

    return {"items": items, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.get("/my-listings")
async def my_listings(
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """Get merchant's own listings."""
    q = await db.execute(
        select(MarketplaceListing)
        .where(MarketplaceListing.merchant_id == merchant.id)
        .order_by(MarketplaceListing.created_at.desc())
    )
    return [ListingResponse.model_validate(l).model_dump() for l in q.scalars().all()]


@router.post("/listings", response_model=ListingResponse)
async def create_listing(
    data: ListingCreate,
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
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
    await db.flush()
    await db.refresh(listing)
    return ListingResponse.model_validate(listing)


@router.patch("/listings/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: str,
    data: ListingUpdate,
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
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

    await db.flush()
    await db.refresh(listing)
    return ListingResponse.model_validate(listing)


@router.delete("/listings/{listing_id}", status_code=204)
async def delete_listing(
    listing_id: str,
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
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
    await db.flush()


# ─── Orders ───

@router.post("/orders", response_model=MarketplaceOrderResponse)
async def create_order(
    data: MarketplaceOrderCreate,
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """Place an order on a marketplace listing."""
    listing_q = await db.execute(
        select(MarketplaceListing).where(MarketplaceListing.id == data.listing_id)
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

    await db.flush()
    await db.refresh(order)

    return _enrich_order(order, listing.title, merchant.business_name, None)


@router.get("/orders/buying")
async def my_buying_orders(
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """Orders where I am the buyer."""
    q = await db.execute(
        select(MarketplaceOrder)
        .where(MarketplaceOrder.buyer_id == merchant.id)
        .order_by(MarketplaceOrder.created_at.desc())
    )
    orders = q.scalars().all()
    return [await _load_order_details(db, o) for o in orders]


@router.get("/orders/selling")
async def my_selling_orders(
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """Orders where I am the seller."""
    q = await db.execute(
        select(MarketplaceOrder)
        .where(MarketplaceOrder.seller_id == merchant.id)
        .order_by(MarketplaceOrder.created_at.desc())
    )
    orders = q.scalars().all()
    return [await _load_order_details(db, o) for o in orders]


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    data: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_current_merchant),
):
    """Update order status (seller accepts/ships, buyer confirms delivery)."""
    result = await db.execute(select(MarketplaceOrder).where(MarketplaceOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Commande introuvable")

    # Seller can: ACCEPTED, SHIPPED, CANCELLED
    # Buyer can: DELIVERED, DISPUTED, CANCELLED
    new_status = MarketplaceOrderStatus(data.status)

    if merchant.id == order.seller_id and new_status in (
        MarketplaceOrderStatus.ACCEPTED, MarketplaceOrderStatus.SHIPPED, MarketplaceOrderStatus.CANCELLED
    ):
        order.status = new_status
    elif merchant.id == order.buyer_id and new_status in (
        MarketplaceOrderStatus.DELIVERED, MarketplaceOrderStatus.DISPUTED, MarketplaceOrderStatus.CANCELLED
    ):
        order.status = new_status
    else:
        raise HTTPException(403, "Action non autorisee")

    # If cancelled, restore listing quantity
    if new_status == MarketplaceOrderStatus.CANCELLED:
        listing_q = await db.execute(
            select(MarketplaceListing).where(MarketplaceListing.id == order.listing_id)
        )
        listing = listing_q.scalar_one_or_none()
        if listing:
            listing.available_quantity += order.quantity
            if listing.status == ListingStatus.SOLD:
                listing.status = ListingStatus.ACTIVE

    await db.flush()
    return await _load_order_details(db, order)


# ─── Helpers ───

async def _load_order_details(db: AsyncSession, order: MarketplaceOrder) -> dict:
    listing_q = await db.execute(select(MarketplaceListing.title).where(MarketplaceListing.id == order.listing_id))
    listing_title = listing_q.scalar()
    buyer_q = await db.execute(select(Merchant.business_name).where(Merchant.id == order.buyer_id))
    buyer_name = buyer_q.scalar()
    seller_q = await db.execute(select(Merchant.business_name).where(Merchant.id == order.seller_id))
    seller_name = seller_q.scalar()
    return _enrich_order(order, listing_title, buyer_name, seller_name)


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
