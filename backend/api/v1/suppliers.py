from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.supplier import Supplier
from models.supplier_order import SupplierOrder, SupplierOrderStatus
from models.product import Product
from models.notification import Notification
from schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse, SupplierOrderResponse
from services.supplier_aggregation import create_aggregated_bulk_order
from services.payment_service import create_payment
from services.whatsapp import send_text_message
from services.sse_events import publish_event

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("/", response_model=list[SupplierResponse])
async def list_suppliers(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Supplier).where(
            Supplier.is_active == True,
            Supplier.merchant_id == merchant.id,
        )
    )
    return result.scalars().all()


@router.post("/", response_model=SupplierResponse, status_code=201)
async def create_supplier(
    data: SupplierCreate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if data.minimum_order_value < 0:
        raise HTTPException(400, "La commande minimum ne peut pas etre negative")
    existing = await db.execute(
        select(Supplier).where(
            Supplier.name == data.name,
            Supplier.is_active == True,
            Supplier.merchant_id == merchant.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Le fournisseur '{data.name}' existe deja")
    supplier = Supplier(merchant_id=merchant.id, **data.model_dump())
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.merchant_id == merchant.id)
    )
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    if data.minimum_order_value is not None and data.minimum_order_value < 0:
        raise HTTPException(400, "La commande minimum ne peut pas etre negative")
    if data.name and data.name != supplier.name:
        dup = await db.execute(
            select(Supplier).where(Supplier.name == data.name, Supplier.is_active == True, Supplier.id != supplier_id)
        )
        if dup.scalar_one_or_none():
            raise HTTPException(400, f"Le fournisseur '{data.name}' existe deja")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=204)
async def delete_supplier(
    supplier_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.merchant_id == merchant.id)
    )
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    supplier.is_active = False
    await db.commit()


@router.delete("/{supplier_id}/orders/{order_id}", status_code=204)
async def delete_order(
    supplier_id: str,
    order_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(SupplierOrder).where(
            SupplierOrder.id == order_id,
            SupplierOrder.supplier_id == supplier_id,
            SupplierOrder.merchant_id == merchant.id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Commande introuvable")
    if order.payment_id:
        raise HTTPException(400, "Impossible de supprimer une commande deja payee")
    await db.delete(order)
    await db.commit()


@router.get("/{supplier_id}/orders", response_model=list[SupplierOrderResponse])
async def list_supplier_orders(
    supplier_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(SupplierOrder).where(
            SupplierOrder.supplier_id == supplier_id,
            SupplierOrder.merchant_id == merchant.id,
        )
    )
    return result.scalars().all()


class OrderItemRequest(BaseModel):
    product_id: str | None = None
    product_name: str | None = None
    unit_price: float | None = None
    quantity: int


class PlaceOrderRequest(BaseModel):
    items: list[OrderItemRequest]


@router.post("/{supplier_id}/order", status_code=201)
async def place_order(
    supplier_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    body: PlaceOrderRequest | None = None,
    product_id: str | None = None,
    quantity: int | None = None,
):
    sup_result = await db.execute(select(Supplier).where(Supplier.id == supplier_id, Supplier.is_active == True))
    supplier = sup_result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")

    # Support both old (query params) and new (JSON body) format
    if body and body.items:
        item_requests = body.items
    elif product_id and quantity:
        item_requests = [OrderItemRequest(product_id=product_id, quantity=quantity)]
    else:
        raise HTTPException(400, "Ajoutez au moins un produit a la commande")

    # Separate catalog products and custom items
    catalog_ids = [it.product_id for it in item_requests if it.product_id]
    products_map = {}
    if catalog_ids:
        prod_result = await db.execute(
            select(Product).where(Product.id.in_(catalog_ids), Product.merchant_id == merchant.id)
        )
        products_map = {p.id: p for p in prod_result.scalars().all()}

    items_data = []
    total = 0.0
    items_summary = []
    for it in item_requests:
        if it.product_id and it.product_id in products_map:
            # Catalog product
            product = products_map[it.product_id]
            price = float(product.cost_price)
            name = product.name_fr or product.name_ar or "—"
            items_data.append({
                "product_id": product.id,
                "product_name": name,
                "quantity": it.quantity,
                "unit_price": price,
            })
        elif it.product_name and it.unit_price is not None:
            # Custom item (not in catalog)
            price = it.unit_price
            name = it.product_name
            items_data.append({
                "product_name": name,
                "quantity": it.quantity,
                "unit_price": price,
            })
        else:
            raise HTTPException(400, "Chaque article doit avoir un product_id OU un product_name + unit_price")
        line_total = it.quantity * price
        total += line_total
        items_summary.append(f"{name} x{it.quantity}")

    order = SupplierOrder(
        merchant_id=merchant.id,
        supplier_id=supplier_id,
        items=items_data,
        total_amount=total,
        status=SupplierOrderStatus.PENDING,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    summary_text = ", ".join(items_summary[:3])
    if len(items_summary) > 3:
        summary_text += f" +{len(items_summary) - 3} autres"

    # Notify supplier via WhatsApp
    if supplier.phone_number:
        try:
            from services.whatsapp import normalize_phone
            phone = normalize_phone(supplier.phone_number)
            msg = (
                f"🛒 Nouvelle commande de {merchant.business_name}\n"
                f"Articles: {summary_text}\n"
                f"Total: {total:.2f} MAD\n"
                f"Reference: #{order.id[:8].upper()}"
            )
            await send_text_message(phone, msg)
        except Exception as e:
            print(f"[WhatsApp Order] Failed: {e}")

    # SSE + DB notification to supplier portal
    if supplier.supplier_account_id:
        notif = Notification(
            merchant_id=supplier.supplier_account_id,
            type="order",
            title=f"Nouvelle commande de {merchant.business_name}",
            message=f"{summary_text} — {total:.2f} MAD",
        )
        db.add(notif)
        await db.commit()

        try:
            await publish_event(f"supplier:{supplier.supplier_account_id}", "new_order", {
                "order_id": order.id,
                "merchant_name": merchant.business_name,
                "items": items_summary,
                "total": total,
                "status": order.status.value,
            })
        except Exception:
            pass

    return {
        "id": order.id,
        "supplier_id": order.supplier_id,
        "merchant_id": order.merchant_id,
        "items": order.items,
        "total_amount": float(order.total_amount),
        "status": order.status.value,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


@router.post("/{supplier_id}/aggregate")
async def aggregate_orders(
    supplier_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Fournisseur introuvable")
    return await create_aggregated_bulk_order(db, supplier.id)


class PayOrderRequest(BaseModel):
    method: str


@router.post("/{supplier_id}/orders/{order_id}/pay")
async def pay_supplier_order(
    supplier_id: str,
    order_id: str,
    req: PayOrderRequest,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if req.method not in ("CASH", "NFC_SOUKCARD"):
        raise HTTPException(400, "Methode de paiement invalide (CASH ou NFC_SOUKCARD)")

    result = await db.execute(
        select(SupplierOrder).where(
            SupplierOrder.id == order_id,
            SupplierOrder.supplier_id == supplier_id,
            SupplierOrder.merchant_id == merchant.id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "Commande introuvable")

    if order.payment_id:
        raise HTTPException(400, "Cette commande est deja payee")

    if order.status not in (SupplierOrderStatus.SUBMITTED, SupplierOrderStatus.IN_DELIVERY, SupplierOrderStatus.DELIVERED):
        raise HTTPException(400, "La commande doit etre confirmee avant le paiement")

    payment_result = await create_payment(
        db, merchant.id, req.method, float(order.total_amount),
        order_id=order.id, order_type="supplier",
        description=f"Paiement fournisseur — Commande #{order.id[:8].upper()}",
    )

    order.payment_id = payment_result["id"]
    await db.commit()

    # Fetch supplier to get supplier_account_id
    sup_result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = sup_result.scalar_one_or_none()

    # Notify merchant
    notif_merchant = Notification(
        merchant_id=merchant.id,
        type="payment",
        title=f"Paiement de {float(order.total_amount):.2f} MAD envoye",
        message=f"Fournisseur: {supplier.name if supplier else '—'} — Ref: {payment_result.get('external_ref', '')}",
    )
    db.add(notif_merchant)

    # Notify supplier account if linked
    if supplier and supplier.supplier_account_id:
        notif_supplier = Notification(
            merchant_id=supplier.supplier_account_id,
            type="payment",
            title=f"Paiement de {float(order.total_amount):.2f} MAD recu",
            message=f"De: {merchant.business_name} — Ref: {payment_result.get('external_ref', '')}",
        )
        db.add(notif_supplier)

    await db.commit()

    return payment_result


