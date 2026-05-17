"""Supplier chatbot — AI-powered assistant for supplier portal."""

import json
from datetime import datetime, timezone, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.deps import get_current_supplier
from models.merchant import Merchant
from models.supplier import Supplier
from models.supplier_order import SupplierOrder, SupplierOrderStatus
from models.payment import Payment
from app.config import settings

router = APIRouter(prefix="/supplier-chat", tags=["Supplier Chat"])


class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    actions: list[dict] = []


async def _build_supplier_context(db: AsyncSession, merchant: Merchant) -> str:
    """Build context string with supplier's current data."""
    # Get linked supplier records
    result = await db.execute(
        select(Supplier.id, Supplier.name).where(
            Supplier.supplier_account_id == merchant.id,
            Supplier.is_active == True,
        )
    )
    supplier_rows = result.all()
    supplier_ids = [r.id for r in supplier_rows]

    if not supplier_ids:
        return f"Fournisseur: {merchant.business_name}\nAucune fiche fournisseur liee. Aucune commande."

    # Get orders from last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    orders_result = await db.execute(
        select(SupplierOrder).where(
            SupplierOrder.supplier_id.in_(supplier_ids),
            SupplierOrder.created_at >= thirty_days_ago,
        ).order_by(SupplierOrder.created_at.desc()).limit(20)
    )
    orders = orders_result.scalars().all()

    # Get merchant names
    merchant_ids = list({o.merchant_id for o in orders if o.merchant_id})
    merchants_map = {}
    if merchant_ids:
        m_result = await db.execute(
            select(Merchant.id, Merchant.business_name).where(Merchant.id.in_(merchant_ids))
        )
        merchants_map = {r.id: r.business_name for r in m_result.all()}

    # Get payments
    order_ids = [o.id for o in orders]
    total_paid = 0
    if order_ids:
        pay_result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.order_type == "supplier",
                Payment.order_id.in_(order_ids),
                Payment.status == "COMPLETED",
            )
        )
        total_paid = float(pay_result.scalar() or 0)

    # Status counts
    status_counts = {}
    for o in orders:
        s = o.status.value
        status_counts[s] = status_counts.get(s, 0) + 1

    # Build context
    total_amount = sum(float(o.total_amount) for o in orders)

    orders_detail = []
    for o in orders[:10]:
        items_str = ", ".join(
            f"{item.get('product_name', '?')} x{item.get('quantity', 0)}"
            for item in (o.items or [])
        )
        orders_detail.append(
            f"- #{o.id[:8].upper()} | {merchants_map.get(o.merchant_id, '?')} | "
            f"{items_str} | {float(o.total_amount):.2f} MAD | Statut: {o.status.value} | "
            f"{o.created_at.strftime('%d/%m/%Y') if o.created_at else '?'}"
        )

    context = (
        f"Fournisseur: {merchant.business_name}\n"
        f"Fiches liees: {', '.join(r.name for r in supplier_rows)}\n"
        f"Commandes (30 jours): {len(orders)} — Total: {total_amount:.2f} MAD\n"
        f"Statuts: {json.dumps(status_counts, ensure_ascii=False)}\n"
        f"Paiements recus: {total_paid:.2f} MAD\n"
        f"Commandes impayees: {total_amount - total_paid:.2f} MAD\n\n"
        f"Dernieres commandes:\n" + "\n".join(orders_detail)
    )
    return context


@router.post("/message", response_model=ChatResponse)
async def chat_message(
    data: ChatMessage,
    merchant: Annotated[Merchant, Depends(get_current_supplier)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from openai import AsyncOpenAI

    if not settings.OPENAI_API_KEY:
        raise HTTPException(503, "Service AI non configure")

    context = await _build_supplier_context(db, merchant)

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=500,
        temperature=0.7,
        messages=[
            {
                "role": "system",
                "content": (
                    "Tu es l'assistant intelligent du fournisseur sur la plateforme Souk.AI. "
                    "Tu parles en Darija/Francais melange comme un marocain. "
                    "Tu aides le fournisseur a gerer ses commandes, suivre ses livraisons et paiements. "
                    "Tu peux lui donner des resumés, l'alerter sur les commandes en attente, "
                    "et lui conseiller des actions. "
                    "Si le fournisseur demande d'accepter ou changer le statut d'une commande, "
                    "inclus dans ta reponse un champ 'actions' avec les commandes a executer.\n\n"
                    "Format de reponse JSON obligatoire:\n"
                    '{"reply": "ton message", "actions": [{"type": "update_status", "order_id": "...", "status": "IN_DELIVERY"}]}\n'
                    "Si pas d'action, actions = []\n\n"
                    f"Contexte actuel:\n{context}"
                ),
            },
            {"role": "user", "content": data.message},
        ],
    )

    raw = response.choices[0].message.content.strip()
    # Clean markdown code blocks
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        parsed = json.loads(raw)
        reply = parsed.get("reply", raw)
        actions = parsed.get("actions", [])
    except (json.JSONDecodeError, KeyError):
        reply = raw
        actions = []

    # Execute actions if present
    executed = []
    for action in actions:
        if action.get("type") == "update_status":
            order_id = action.get("order_id", "")
            new_status = action.get("status", "")
            try:
                # Find the order
                supplier_ids_result = await db.execute(
                    select(Supplier.id).where(
                        Supplier.supplier_account_id == merchant.id,
                        Supplier.is_active == True,
                    )
                )
                s_ids = [r for r in supplier_ids_result.scalars().all()]

                order_result = await db.execute(
                    select(SupplierOrder).where(
                        SupplierOrder.id.like(f"{order_id}%"),
                        SupplierOrder.supplier_id.in_(s_ids),
                    )
                )
                order = order_result.scalar_one_or_none()
                if order:
                    order.status = SupplierOrderStatus(new_status)
                    if new_status == "IN_DELIVERY":
                        order.submitted_at = datetime.now(timezone.utc)
                    elif new_status == "DELIVERED":
                        order.delivered_at = datetime.now(timezone.utc)
                    await db.commit()
                    executed.append({"order_id": order.id[:8], "status": new_status, "success": True})
                else:
                    executed.append({"order_id": order_id, "status": new_status, "success": False, "error": "introuvable"})
            except Exception as e:
                executed.append({"order_id": order_id, "error": str(e), "success": False})

    if executed:
        reply += "\n\n✅ Actions executees: " + ", ".join(
            f"#{a['order_id']} → {a.get('status', '?')}" if a['success']
            else f"#{a['order_id']} ❌ {a.get('error', 'erreur')}"
            for a in executed
        )

    return ChatResponse(reply=reply, actions=executed)
