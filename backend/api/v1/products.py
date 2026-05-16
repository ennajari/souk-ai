import base64
import json
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from core.database import get_db
from core.deps import get_current_merchant
from app.config import settings
from models.merchant import Merchant
from models.product import Product
from models.inventory import Inventory
from schemas.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=list[ProductResponse])
async def list_products(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Product).where(Product.merchant_id == merchant.id, Product.is_active == True)  # noqa: E712
    )
    products = result.scalars().all()

    response = []
    for p in products:
        stock = None
        if p.inventory:
            stock = float(p.inventory.quantity)
        response.append(ProductResponse(
            id=p.id, merchant_id=p.merchant_id, name_ar=p.name_ar, name_fr=p.name_fr,
            barcode=p.barcode, unit=p.unit, unit_price=float(p.unit_price),
            cost_price=float(p.cost_price), is_active=p.is_active,
            created_at=p.created_at, stock_quantity=stock,
        ))
    return response


@router.post("/", response_model=ProductResponse, status_code=201)
async def create_product(
    req: ProductCreate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = req.model_dump()
    initial_stock = data.pop('initial_stock', 0) or 0

    name_fr = (data.get("name_fr") or "").strip().lower()
    name_ar = (data.get("name_ar") or "").strip().lower()
    dup_conditions = []
    if name_fr:
        dup_conditions.extend([
            func.lower(Product.name_fr) == name_fr,
            func.lower(Product.name_ar) == name_fr,
        ])
    if name_ar:
        dup_conditions.extend([
            func.lower(Product.name_fr) == name_ar,
            func.lower(Product.name_ar) == name_ar,
        ])
    if dup_conditions:
        dup_result = await db.execute(
            select(Product).where(
                Product.merchant_id == merchant.id,
                Product.is_active == True,
                or_(*dup_conditions),
            ).limit(1)
        )
        existing = dup_result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Produit similaire existe deja: {existing.name_fr} / {existing.name_ar} (ID: {existing.id})"
            )

    product = Product(merchant_id=merchant.id, **data)
    db.add(product)
    await db.commit()

    # Create inventory entry with initial stock
    inventory = Inventory(product_id=product.id, quantity=initial_stock)
    db.add(inventory)
    await db.commit()

    return ProductResponse(
        id=product.id, merchant_id=product.merchant_id, name_ar=product.name_ar,
        name_fr=product.name_fr, barcode=product.barcode, unit=product.unit,
        unit_price=float(product.unit_price), cost_price=float(product.cost_price),
        is_active=product.is_active, created_at=product.created_at, stock_quantity=initial_stock,
    )


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.merchant_id == merchant.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    stock = float(product.inventory.quantity) if product.inventory else None
    return ProductResponse(
        id=product.id, merchant_id=product.merchant_id, name_ar=product.name_ar,
        name_fr=product.name_fr, barcode=product.barcode, unit=product.unit,
        unit_price=float(product.unit_price), cost_price=float(product.cost_price),
        is_active=product.is_active, created_at=product.created_at, stock_quantity=stock,
    )


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    req: ProductUpdate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.merchant_id == merchant.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    await db.commit()
    stock = float(product.inventory.quantity) if product.inventory else None
    return ProductResponse(
        id=product.id, merchant_id=product.merchant_id, name_ar=product.name_ar,
        name_fr=product.name_fr, barcode=product.barcode, unit=product.unit,
        unit_price=float(product.unit_price), cost_price=float(product.cost_price),
        is_active=product.is_active, created_at=product.created_at, stock_quantity=stock,
    )


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.merchant_id == merchant.id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    product.is_active = False
    await db.commit()


@router.post("/{keep_id}/merge/{remove_id}", response_model=ProductResponse)
async def merge_products(
    keep_id: str,
    remove_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Merge two duplicate products: keep one, transfer stock + transactions from the other."""
    keep_result = await db.execute(
        select(Product).where(Product.id == keep_id, Product.merchant_id == merchant.id)
    )
    keep = keep_result.scalar_one_or_none()
    if not keep:
        raise HTTPException(404, "Produit principal introuvable")

    remove_result = await db.execute(
        select(Product).where(Product.id == remove_id, Product.merchant_id == merchant.id)
    )
    remove = remove_result.scalar_one_or_none()
    if not remove:
        raise HTTPException(404, "Produit doublon introuvable")

    if not keep.name_ar and remove.name_ar:
        keep.name_ar = remove.name_ar
    if not keep.name_fr and remove.name_fr:
        keep.name_fr = remove.name_fr
    if not keep.barcode and remove.barcode:
        keep.barcode = remove.barcode
    if float(keep.unit_price or 0) == 0 and float(remove.unit_price or 0) > 0:
        keep.unit_price = remove.unit_price
    if float(keep.cost_price or 0) == 0 and float(remove.cost_price or 0) > 0:
        keep.cost_price = remove.cost_price

    from models.transaction import Transaction
    await db.execute(
        Transaction.__table__.update()
        .where(Transaction.product_id == remove_id)
        .values(product_id=keep_id)
    )

    keep_inv = keep.inventory
    remove_inv_result = await db.execute(select(Inventory).where(Inventory.product_id == remove_id))
    remove_inv = remove_inv_result.scalar_one_or_none()
    if remove_inv:
        if keep_inv:
            keep_inv.quantity = float(keep_inv.quantity) + float(remove_inv.quantity)
        else:
            remove_inv.product_id = keep_id
        if remove_inv and keep_inv:
            await db.delete(remove_inv)

    remove.is_active = False
    await db.commit()

    stock = float(keep.inventory.quantity) if keep.inventory else None
    return ProductResponse(
        id=keep.id, merchant_id=keep.merchant_id, name_ar=keep.name_ar,
        name_fr=keep.name_fr, barcode=keep.barcode, unit=keep.unit,
        unit_price=float(keep.unit_price), cost_price=float(keep.cost_price),
        is_active=keep.is_active, created_at=keep.created_at, stock_quantity=stock,
    )


@router.post("/scan-invoice")
async def scan_invoice(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    file: UploadFile = File(...),
):
    """Upload a supplier invoice image → GPT-4o Vision extracts products with prices & quantities."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OpenAI non configuré")

    image_bytes = await file.read()
    b64 = base64.b64encode(image_bytes).decode()
    mime = file.content_type or "image/jpeg"

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    prompt = (
        "You are analyzing a supplier delivery invoice (bon de livraison / facture fournisseur) from Morocco.\n"
        "Extract ALL product lines from the invoice table.\n"
        "Return ONLY a valid JSON array with this exact structure:\n"
        '[{"name": "PRODUCT NAME", "quantity": 24, "unit_price": 4.60, "cost_price": 3.45}]\n'
        "Rules:\n"
        "- name: exact product name as written on the invoice (uppercase)\n"
        "- quantity: integer quantity received (VNT or Qté column)\n"
        "- unit_price: selling price TTC (PRIX column, or Prix TTC). Use 0 if missing.\n"
        "- cost_price: purchase price HT (Net HT / Prix HT column). Use 0 if missing.\n"
        "- Include ALL rows, even if price is missing (use 0)\n"
        "- Respond ONLY with the JSON array, no markdown, no explanation."
    )

    response = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=1500,
        temperature=0,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"}},
            ],
        }],
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:].strip()

    try:
        items = json.loads(raw)
        if not isinstance(items, list):
            items = []
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="Impossible d'extraire les données de la facture")

    return {"items": items, "count": len(items)}
