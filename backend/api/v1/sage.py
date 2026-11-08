from typing import Annotated
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from core.uploads import read_limited
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from sqlalchemy.orm import selectinload

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.product import Product
from models.inventory import Inventory
from models.transaction import Transaction, TransactionType, TransactionSource
from services.sage_import import (
    parse_sage_articles, parse_sage_sales, parse_sage_clients,
    detect_sage_file_type,
)

router = APIRouter(prefix="/sage", tags=["sage"])


@router.post("/import/articles")
async def import_sage_articles(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    """Import products from a Sage 100 articles CSV export."""
    if not file.filename.endswith(('.csv', '.txt', '.CSV', '.TXT')):
        raise HTTPException(400, "Format non supporté. Envoyez un fichier CSV.")

    raw = await read_limited(file)
    # Try multiple encodings (Sage often uses Windows-1252)
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            content = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise HTTPException(400, "Impossible de lire le fichier. Encodage non reconnu.")

    articles = parse_sage_articles(content)
    if not articles:
        raise HTTPException(400, "Aucun article trouvé dans le fichier. Vérifiez le format Sage 100.")

    added = []
    updated = []

    for art in articles:
        name = art.get('name', '')
        art.get('reference', '')

        # Check if product already exists (by barcode or name)
        existing = None
        if art.get('barcode'):
            result = await db.execute(
                select(Product).where(
                    Product.merchant_id == merchant.id,
                    Product.barcode == art['barcode'],
                    Product.is_active == True,
                ).options(selectinload(Product.inventory))
            )
            existing = result.scalar_one_or_none()

        if not existing:
            result = await db.execute(
                select(Product).where(
                    Product.merchant_id == merchant.id,
                    (Product.name_fr == name) | (Product.name_ar == name),
                    Product.is_active == True,
                ).options(selectinload(Product.inventory))
            )
            existing = result.scalar_one_or_none()

        if existing:
            # Update existing product
            if art.get('unit_price'):
                existing.unit_price = art['unit_price']
            if art.get('cost_price'):
                existing.cost_price = art['cost_price']
            if art.get('barcode'):
                existing.barcode = art['barcode']
            if art.get('unit'):
                existing.unit = art['unit']

            # Update stock if provided
            if art.get('stock') is not None and existing.inventory:
                existing.inventory.quantity = art['stock']
            elif art.get('stock') is not None and not existing.inventory:
                inv = Inventory(product_id=existing.id, quantity=art['stock'])
                db.add(inv)

            updated.append(name)
        else:
            # Create new product
            product = Product(
                merchant_id=merchant.id,
                name_ar=name,
                name_fr=name,
                barcode=art.get('barcode'),
                unit=art.get('unit', 'piece'),
                unit_price=art.get('unit_price', 0),
                cost_price=art.get('cost_price', 0),
            )
            db.add(product)
            await db.flush()

            # Create inventory
            stock_qty = art.get('stock', 0) or 0
            inv = Inventory(product_id=product.id, quantity=stock_qty)
            db.add(inv)
            added.append(name)

    await db.commit()

    return {
        "status": "success",
        "total_parsed": len(articles),
        "added": len(added),
        "updated": len(updated),
        "added_products": added[:20],
        "updated_products": updated[:20],
    }


@router.post("/import/sales")
async def import_sage_sales(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    """Import sales/invoices from a Sage 100 sales CSV export."""
    if not file.filename.endswith(('.csv', '.txt', '.CSV', '.TXT')):
        raise HTTPException(400, "Format non supporté. Envoyez un fichier CSV.")

    raw = await read_limited(file)
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            content = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise HTTPException(400, "Impossible de lire le fichier. Encodage non reconnu.")

    sales = parse_sage_sales(content)
    if not sales:
        raise HTTPException(400, "Aucune vente trouvée dans le fichier. Vérifiez le format Sage 100.")

    imported = 0
    skipped = 0

    for sale in sales:
        product_name = sale.get('product_name') or sale.get('product_ref', '')
        quantity = sale.get('quantity', 1)
        unit_price = sale.get('unit_price', 0)
        total = sale.get('total_ttc') or sale.get('total_ht') or (quantity * unit_price)

        # Find matching product
        result = await db.execute(
            select(Product).where(
                Product.merchant_id == merchant.id,
                (Product.name_fr == product_name) | (Product.name_ar == product_name),
                Product.is_active == True,
            )
        )
        product = result.scalar_one_or_none()

        if not product:
            # Try partial match
            result = await db.execute(
                select(Product).where(
                    Product.merchant_id == merchant.id,
                    Product.is_active == True,
                    Product.name_fr.ilike(f"%{product_name}%"),
                )
            )
            product = result.scalar_one_or_none()

        if not product:
            skipped += 1
            continue

        # Create transaction
        txn = Transaction(
            merchant_id=merchant.id,
            product_id=product.id,
            type=TransactionType.SALE,
            source=TransactionSource.API,
            quantity=int(quantity) if quantity else 1,
            unit_price=float(unit_price) if unit_price else float(product.unit_price),
            total_amount=float(total) if total else 0,
        )
        db.add(txn)
        imported += 1

    await db.commit()

    return {
        "status": "success",
        "total_parsed": len(sales),
        "imported": imported,
        "skipped": skipped,
    }


@router.post("/import/auto")
async def import_sage_auto(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    """Auto-detect Sage 100 file type and import accordingly."""
    if not file.filename.endswith(('.csv', '.txt', '.CSV', '.TXT')):
        raise HTTPException(400, "Format non supporté. Envoyez un fichier CSV.")

    raw = await read_limited(file)
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            content = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise HTTPException(400, "Impossible de lire le fichier. Encodage non reconnu.")

    file_type = detect_sage_file_type(content)
    if not file_type:
        raise HTTPException(400, "Type de fichier non reconnu. Utilisez un export Sage 100 (articles, ventes, ou clients).")

    if file_type == 'articles':
        articles = parse_sage_articles(content)
        if not articles:
            raise HTTPException(400, "Aucun article trouvé.")

        added = []
        updated = []
        for art in articles:
            name = art.get('name', '')
            result = await db.execute(
                select(Product).where(
                    Product.merchant_id == merchant.id,
                    (Product.name_fr == name) | (Product.name_ar == name),
                    Product.is_active == True,
                ).options(selectinload(Product.inventory))
            )
            existing = result.scalar_one_or_none()

            if existing:
                if art.get('unit_price'):
                    existing.unit_price = art['unit_price']
                if art.get('cost_price'):
                    existing.cost_price = art['cost_price']
                if art.get('barcode'):
                    existing.barcode = art['barcode']
                if art.get('stock') is not None and existing.inventory:
                    existing.inventory.quantity = art['stock']
                updated.append(name)
            else:
                product = Product(
                    merchant_id=merchant.id, name_ar=name, name_fr=name,
                    barcode=art.get('barcode'), unit=art.get('unit', 'piece'),
                    unit_price=art.get('unit_price', 0), cost_price=art.get('cost_price', 0),
                )
                db.add(product)
                await db.flush()
                inv = Inventory(product_id=product.id, quantity=art.get('stock', 0) or 0)
                db.add(inv)
                added.append(name)

        await db.commit()
        return {
            "status": "success", "file_type": "articles",
            "total_parsed": len(articles), "added": len(added), "updated": len(updated),
            "added_products": added[:20], "updated_products": updated[:20],
        }

    elif file_type == 'sales':
        sales = parse_sage_sales(content)
        if not sales:
            raise HTTPException(400, "Aucune vente trouvée.")
        imported = 0
        skipped = 0
        for sale in sales:
            product_name = sale.get('product_name') or sale.get('product_ref', '')
            result = await db.execute(
                select(Product).where(
                    Product.merchant_id == merchant.id, Product.is_active == True,
                    (Product.name_fr == product_name) | (Product.name_ar == product_name),
                )
            )
            product = result.scalar_one_or_none()
            if not product:
                skipped += 1
                continue
            quantity = sale.get('quantity', 1)
            unit_price = sale.get('unit_price', 0)
            total = sale.get('total_ttc') or sale.get('total_ht') or (quantity * unit_price)
            txn = Transaction(
                merchant_id=merchant.id, product_id=product.id,
                type=TransactionType.SALE, source=TransactionSource.API,
                quantity=int(quantity) if quantity else 1,
                unit_price=float(unit_price) if unit_price else float(product.unit_price),
                total_amount=float(total) if total else 0,
            )
            db.add(txn)
            imported += 1
        await db.commit()
        return {"status": "success", "file_type": "sales", "total_parsed": len(sales), "imported": imported, "skipped": skipped}

    elif file_type == 'clients':
        clients = parse_sage_clients(content)
        return {"status": "success", "file_type": "clients", "total_parsed": len(clients), "clients": clients[:20]}
