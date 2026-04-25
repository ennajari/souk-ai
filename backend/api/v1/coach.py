import json
from datetime import datetime, timezone, timedelta
from collections import Counter, defaultdict
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.product import Product
from models.transaction import Transaction, TransactionType
from app.config import settings

router = APIRouter(prefix="/coach", tags=["coach"])


# ---------- Schemas ----------

class CoachTip(BaseModel):
    tip: str
    category: str  # stock | sales | profit | seasonal
    priority: str  # high | medium | low


class InsightsResponse(BaseModel):
    best_seller: dict | None = None
    worst_performer: dict | None = None
    peak_day: dict | None = None
    avg_basket: float = 0.0
    stock_days: list[dict] = []


# ---------- Endpoints ----------

@router.get("/tips", response_model=list[CoachTip])
async def get_tips(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generate 3 personalized tips based on merchant data using AI."""
    from openai import AsyncOpenAI

    if not settings.OPENAI_API_KEY:
        raise HTTPException(503, "Service AI non configure")

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Fetch recent transactions
    txn_result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant.id,
            Transaction.created_at >= thirty_days_ago,
        )
    )
    transactions = txn_result.scalars().all()

    # Fetch products with inventory
    prod_result = await db.execute(
        select(Product).where(
            Product.merchant_id == merchant.id,
            Product.is_active is True,
        )
    )
    products = prod_result.scalars().all()

    # Build context summary
    total_sales = sum(float(t.total_amount) for t in transactions if t.type == TransactionType.SALE)
    sale_count = sum(1 for t in transactions if t.type == TransactionType.SALE)
    low_stock_items = []
    high_margin_items = []
    low_margin_items = []

    for p in products:
        stock_qty = p.inventory.quantity if p.inventory else 0
        if stock_qty <= 5:
            low_stock_items.append(f"{p.name_fr or p.name_ar} ({stock_qty} restants)")
        margin = float(p.unit_price) - float(p.cost_price) if float(p.cost_price) > 0 else 0
        if float(p.cost_price) > 0:
            margin_pct = (margin / float(p.cost_price)) * 100
            item_info = {"name": p.name_fr or p.name_ar, "margin_pct": round(margin_pct, 1)}
            if margin_pct > 30:
                high_margin_items.append(item_info)
            elif margin_pct < 10:
                low_margin_items.append(item_info)

    context = (
        f"Marchand: {merchant.business_name}, Categorie: {merchant.business_category.value}\n"
        f"Ventes 30 jours: {sale_count} transactions, {total_sales:.2f} DH\n"
        f"Produits actifs: {len(products)}\n"
        f"Stock bas (<= 5): {', '.join(low_stock_items[:5]) if low_stock_items else 'Aucun'}\n"
        f"Produits marge haute (>30%): {json.dumps(high_margin_items[:3], ensure_ascii=False)}\n"
        f"Produits marge basse (<10%): {json.dumps(low_margin_items[:3], ensure_ascii=False)}\n"
    )

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=600,
        temperature=0.7,
        messages=[
            {
                "role": "system",
                "content": (
                    "Tu es un coach business pour petits commercants marocains. "
                    "Donne exactement 3 conseils pratiques et actionables en Darija/Francais melange (comme parlent les commercants marocains). "
                    "Reponds UNIQUEMENT en JSON valide: une liste de 3 objets avec les cles: tip, category, priority.\n"
                    "Categories possibles: stock, sales, profit, seasonal\n"
                    "Priorites possibles: high, medium, low\n"
                    "Exemple: [{\"tip\": \"...\", \"category\": \"stock\", \"priority\": \"high\"}]"
                ),
            },
            {"role": "user", "content": context},
        ],
    )

    raw = response.choices[0].message.content.strip()
    # Clean markdown code blocks if present
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        tips = json.loads(raw)
        return [CoachTip(**t) for t in tips[:3]]
    except (json.JSONDecodeError, KeyError):
        return [
            CoachTip(tip="Verifiez votre stock regulierement", category="stock", priority="medium"),
            CoachTip(tip="Analysez vos marges pour optimiser les prix", category="profit", priority="medium"),
            CoachTip(tip="Suivez vos ventes quotidiennes", category="sales", priority="low"),
        ]


@router.get("/insights", response_model=InsightsResponse)
async def get_insights(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Quick stats-based insights — no AI, pure calculation."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Fetch recent SALE transactions
    txn_result = await db.execute(
        select(Transaction).where(
            Transaction.merchant_id == merchant.id,
            Transaction.type == TransactionType.SALE,
            Transaction.created_at >= thirty_days_ago,
        )
    )
    transactions = txn_result.scalars().all()

    # Fetch products
    prod_result = await db.execute(
        select(Product).where(
            Product.merchant_id == merchant.id,
            Product.is_active is True,
        )
    )
    products = prod_result.scalars().all()
    products_by_id = {p.id: p for p in products}

    # --- Best seller ---
    product_sales: Counter = Counter()
    product_revenue: defaultdict = defaultdict(float)
    day_counter: Counter = Counter()

    for t in transactions:
        product_sales[t.product_id] += t.quantity
        product_revenue[t.product_id] += float(t.total_amount)
        day_counter[t.created_at.strftime("%A")] += 1

    best_seller = None
    if product_sales:
        best_id = product_sales.most_common(1)[0][0]
        p = products_by_id.get(best_id)
        if p:
            best_seller = {
                "product": p.name_fr or p.name_ar,
                "quantity_sold": product_sales[best_id],
                "revenue": round(product_revenue[best_id], 2),
            }

    # --- Worst performer (lowest margin) ---
    worst_performer = None
    worst_margin = float("inf")
    for p in products:
        if float(p.cost_price) > 0:
            margin_pct = ((float(p.unit_price) - float(p.cost_price)) / float(p.cost_price)) * 100
            if margin_pct < worst_margin:
                worst_margin = margin_pct
                worst_performer = {
                    "product": p.name_fr or p.name_ar,
                    "margin_pct": round(margin_pct, 1),
                    "unit_price": float(p.unit_price),
                    "cost_price": float(p.cost_price),
                }

    # --- Peak day ---
    peak_day = None
    if day_counter:
        day_name, count = day_counter.most_common(1)[0]
        peak_day = {"day": day_name, "transactions": count}

    # --- Average basket ---
    avg_basket = 0.0
    if transactions:
        total_revenue = sum(float(t.total_amount) for t in transactions)
        avg_basket = round(total_revenue / len(transactions), 2)

    # --- Stock days estimation (top 5 products) ---
    stock_days = []
    for pid, qty_sold in product_sales.most_common(5):
        p = products_by_id.get(pid)
        if not p or not p.inventory:
            continue
        current_stock = p.inventory.quantity
        daily_avg = qty_sold / 30.0
        if daily_avg > 0:
            days_left = round(current_stock / daily_avg, 1)
            stock_days.append({
                "product": p.name_fr or p.name_ar,
                "current_stock": current_stock,
                "daily_avg_sales": round(daily_avg, 2),
                "estimated_days_left": days_left,
            })

    return InsightsResponse(
        best_seller=best_seller,
        worst_performer=worst_performer,
        peak_day=peak_day,
        avg_basket=avg_basket,
        stock_days=stock_days,
    )
