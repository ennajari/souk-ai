import asyncio
import base64
import json
import unicodedata
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from workers.celery_app import celery_app
from app.config import settings
from models.merchant import Merchant
from models.product import Product
from models.transaction import Transaction, TransactionType, TransactionSource
from models.conversation import MessageRole, MessageType
from services.ai_engine import process_message
from services.whatsapp import send_text_message
from services.inventory import find_product_by_name, record_sale, get_stock_level, get_low_stock_products
from services.conversation import get_conversation_history, save_message
from services.speech_to_text import download_whatsapp_media, transcribe_audio


def detect_lang(text: str) -> str:
    """Return 'ar' if message is mostly Arabic/Darija, 'en' if English, 'fr' otherwise."""
    arabic_chars = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
    latin_chars = sum(1 for c in text if c.isalpha() and c.isascii())
    if arabic_chars > latin_chars:
        return "ar"
    # Simple English detection: common English words
    lower = text.lower()
    en_words = {"i ", "i'", "sold", "received", "bought", "how much", "report", "stock", "price", "add", "set", "the ", " of ", " a "}
    if any(w in lower for w in en_words):
        return "en"
    return "fr"


def t(key: str, lang: str, **kwargs) -> str:
    """Simple translation helper."""
    translations = {
        "sale_ok": {
            "ar": "✅ {qty} {name} — {total:.2f} درهم | مخزون: {stock}",
            "fr": "✅ {qty} {name} — {total:.2f} MAD | Stock: {stock}",
            "en": "✅ {qty} {name} — {total:.2f} MAD | Stock: {stock}",
        },
        "product_not_found": {
            "ar": "❌ '{name}' غير موجود. أرسل 'جيت ليما X {name}' لإضافته.",
            "fr": "❌ '{name}' introuvable. Envoyez 'j'ai recu X {name}' pour l'ajouter.",
            "en": "❌ '{name}' not found. Send 'I received X {name}' to add it.",
        },
        "stock_level": {
            "ar": "📦 {name}: {stock} {unit}",
            "fr": "📦 {name}: {stock} {unit}",
            "en": "📦 {name}: {stock} {unit}",
        },
        "product_added_with_price": {
            "ar": "✅ {name} | {qty} {unit} | {price:.2f} درهم",
            "fr": "✅ {name} | {qty} {unit} | {price:.2f} MAD",
            "en": "✅ {name} | {qty} {unit} | {price:.2f} MAD",
        },
        "product_added_no_price": {
            "ar": "✅ {name} | {qty} {unit}\n💰 Prix? Ex: '10 DH'",
            "fr": "✅ {name} | {qty} {unit}\n💰 Prix? Ex: '10 DH'",
            "en": "✅ {name} | {qty} {unit}\n💰 Price? Ex: '10 DH'",
        },
        "stock_updated": {
            "ar": "✅ {name} +{qty} → {total}",
            "fr": "✅ {name} +{qty} → {total}",
            "en": "✅ {name} +{qty} → {total}",
        },
        "price_updated": {
            "ar": "✅ {name} = {price:.2f} درهم",
            "fr": "✅ {name} = {price:.2f} MAD",
            "en": "✅ {name} = {price:.2f} MAD",
        },
        "price_which_product": {
            "ar": "❓ لأي منتج؟",
            "fr": "❓ Pour quel produit?",
            "en": "❓ For which product?",
        },
        "stock_ok": {
            "ar": "✅ كل المخزون OK",
            "fr": "✅ Tous les stocks OK",
            "en": "✅ All stocks OK",
        },
        "low_stock_header": {
            "ar": "⚠️ مخزون منخفض:",
            "fr": "⚠️ Stock bas:",
            "en": "⚠️ Low stock:",
        },
        "ask_product_name": {
            "ar": "❓ اسم المنتج والكمية؟",
            "fr": "❓ Nom et quantite?",
            "en": "❓ Product name and quantity?",
        },
    }
    tmpl = translations.get(key, {}).get(lang) or translations.get(key, {}).get("fr", key)
    return tmpl.format(**kwargs) if kwargs else tmpl


def get_async_session():
    """Create a fresh async engine and session for each Celery task."""
    engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, session_factory


def run_async(coro):
    """Helper to run async code in sync Celery tasks."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ---- WhatsApp Text Message ----

@celery_app.task(name="process_whatsapp_message")
def process_whatsapp_message(phone_number: str, text: str):
    """Process incoming WhatsApp text message."""
    return run_async(_process_message(phone_number, text, MessageType.TEXT))


# ---- WhatsApp Voice Message ----

@celery_app.task(name="process_whatsapp_voice_message")
def process_whatsapp_voice_message(phone_number: str, media_id: str):
    """Download, transcribe, then process voice message."""
    return run_async(_process_voice_message(phone_number, media_id))


async def _process_voice_message(phone_number: str, media_id: str):
    try:
        audio_bytes = await download_whatsapp_media(media_id)
        text = await transcribe_audio(audio_bytes)
    except Exception:
        await send_text_message(phone_number, "Desole, je n'ai pas pu comprendre le message vocal.")
        return {"status": "transcription_failed"}

    if not text:
        await send_text_message(phone_number, "Desole, je n'ai pas pu comprendre le message vocal.")
        return {"status": "transcription_failed"}

    return await _process_message(phone_number, text, MessageType.VOICE)


# ---- WhatsApp Image Message (invoice/receipt) ----

@celery_app.task(name="process_whatsapp_image_message")
def process_whatsapp_image_message(phone_number: str, media_id: str, caption: str = ""):
    """Download image, extract invoice items via GPT-4o Vision, add to inventory."""
    return run_async(_process_image_message(phone_number, media_id, caption))


async def _process_image_message(phone_number: str, media_id: str, caption: str):
    from openai import AsyncOpenAI
    from models.inventory import Inventory
    from models.product import Product as Prod

    engine, SessionLocal = get_async_session()
    try:
        async with SessionLocal() as db:
            # Find merchant
            result = await db.execute(select(Merchant).where(Merchant.phone_number == phone_number))
            merchant = result.scalar_one_or_none()
            if not merchant:
                await send_text_message(phone_number, "Inscrivez-vous d'abord sur Souk.AI.")
                return {"status": "unregistered"}

            lang = detect_lang(caption) if caption else "fr"

            # Download image bytes
            try:
                image_bytes = await download_whatsapp_media(media_id)
            except Exception:
                await send_text_message(phone_number, "❌ Impossible de télécharger l'image.")
                return {"status": "download_failed"}

            b64_image = base64.b64encode(image_bytes).decode("utf-8")

            # Call GPT-4o Vision to extract invoice items
            if not settings.OPENAI_API_KEY:
                await send_text_message(phone_number, "❌ Clé OpenAI manquante.")
                return {"status": "no_api_key"}

            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            try:
                response = await client.chat.completions.create(
                    model="gpt-4o",
                    max_tokens=1000,
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"},
                            },
                            {
                                "type": "text",
                                "text": (
                                    "You are analyzing a wholesale invoice or purchase receipt for a Moroccan merchant.\n"
                                    "Extract ALL products listed in this image.\n"
                                    "For each product return a JSON array (no markdown, no explanation):\n"
                                    '[{"name": "product name", "quantity": 10, "unit_price": 5.50, "unit": "piece"}]\n'
                                    "Rules:\n"
                                    "- Keep the product name exactly as written (Arabic or French)\n"
                                    "- quantity must be a number (default 1 if not found)\n"
                                    "- unit_price must be a number in MAD (0 if not found)\n"
                                    "- unit: piece, kg, litre, or carton\n"
                                    "- Respond ONLY with the JSON array."
                                ),
                            },
                        ],
                    }],
                )
                raw = response.choices[0].message.content.strip()
                # Strip markdown code blocks if present
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                items = json.loads(raw)
            except Exception:
                await send_text_message(phone_number, "❌ Impossible d'extraire les produits de l'image. Assurez-vous que la facture est lisible.")
                return {"status": "extraction_failed"}

            if not items or not isinstance(items, list):
                await send_text_message(phone_number, "❌ Aucun produit trouvé dans cette image.")
                return {"status": "no_items"}

            # Add/update products in DB
            added = []
            updated = []
            for item in items:
                name = str(item.get("name", "")).strip()
                qty = float(item.get("quantity", 1) or 1)
                unit_price = float(item.get("unit_price", 0) or 0)
                unit = str(item.get("unit", "piece") or "piece")
                if not name:
                    continue

                existing = await find_product_by_name(db, merchant.id, name)
                if existing:
                    # Restock existing product
                    inv_result = await db.execute(select(Inventory).where(Inventory.product_id == existing.id))
                    inv = inv_result.scalars().first()
                    if inv:
                        inv.quantity = float(inv.quantity) + qty
                        inv.updated_at = datetime.now(timezone.utc)
                        updated.append(f"📦 {name} +{qty:.0f} → {inv.quantity:.0f}")
                    else:
                        new_inv = Inventory(product_id=existing.id, quantity=qty)
                        db.add(new_inv)
                        updated.append(f"📦 {name} +{qty:.0f}")
                    # Update price if provided
                    if unit_price > 0:
                        existing.cost_price = unit_price
                else:
                    # Create new product
                    new_prod = Prod(
                        merchant_id=merchant.id,
                        name_ar=name,
                        name_fr=name,
                        unit=unit,
                        unit_price=0,
                        cost_price=unit_price,
                    )
                    db.add(new_prod)
                    await db.flush()
                    new_inv = Inventory(product_id=new_prod.id, quantity=qty)
                    db.add(new_inv)
                    price_str = f" | {unit_price:.2f} MAD" if unit_price > 0 else " | 💰 Prix?"
                    added.append(f"✅ {name} x{qty:.0f}{price_str}")

            await db.commit()

            # Build reply
            lines = []
            if added:
                lines.append("*Nouveaux produits:*")
                lines.extend(added)
            if updated:
                lines.append("*Stock mis à jour:*")
                lines.extend(updated)
            lines.append(f"\n📊 {len(added)} ajouté(s), {len(updated)} mis à jour")

            await send_text_message(phone_number, "\n".join(lines))
    finally:
        await engine.dispose()

    return {"status": "image_processed", "added": len(added), "updated": len(updated)}


# ---- Core Message Processing (with conversation context) ----

async def _process_message(phone_number: str, text: str, message_type: MessageType = MessageType.TEXT):
    engine, SessionLocal = get_async_session()

    try:
        async with SessionLocal() as db:
            result = await db.execute(select(Merchant).where(Merchant.phone_number == phone_number))
            merchant = result.scalar_one_or_none()

            if not merchant:
                await send_text_message(phone_number, "Bienvenue! Inscrivez-vous sur notre plateforme pour commencer.")
                return {"status": "unregistered"}

            # Load conversation context
            history = await get_conversation_history(db, merchant.id)

            # Save user message
            await save_message(db, merchant.id, MessageRole.USER, text, message_type)

            # Analyze with AI (with context)
            ai_result = await process_message(text, conversation_history=history)
            intent = ai_result.get("intent", "UNKNOWN")
            entities = ai_result.get("entities", {})
            response_text = ai_result.get("response_text", "")

            # Determine transaction source
            source = TransactionSource.VOICE if message_type == MessageType.VOICE else TransactionSource.WHATSAPP
            lang = detect_lang(text)

            if intent == "RECORD_SALE":
                product_name = entities.get("product_name", "")
                quantity = entities.get("quantity", 0)

                if product_name and quantity:
                    product = await find_product_by_name(db, merchant.id, product_name)
                    if product:
                        price = float(product.unit_price)
                        await record_sale(db, merchant.id, product.id, int(quantity), price, source=source)
                        stock = await get_stock_level(db, product.id)
                        display_name = product.name_fr if lang in ("fr", "en") and product.name_fr else product.name_ar
                        response_text = t("sale_ok", lang, qty=quantity, name=display_name, total=quantity * price, stock=stock)
                    else:
                        response_text = t("product_not_found", lang, name=product_name)

            elif intent == "CHECK_STOCK":
                product_name = entities.get("product_name", "")
                if product_name:
                    product = await find_product_by_name(db, merchant.id, product_name)
                    if product:
                        stock = await get_stock_level(db, product.id)
                        display_name = product.name_fr if lang in ("fr", "en") and product.name_fr else product.name_ar
                        response_text = t("stock_level", lang, name=display_name, stock=stock, unit=product.unit)
                    else:
                        response_text = t("product_not_found", lang, name=product_name)

            elif intent == "ADD_PRODUCT":
                product_name = entities.get("product_name", "")
                quantity = entities.get("quantity", 0)
                unit = entities.get("unit", "piece") or "piece"

                if product_name:
                    existing = await find_product_by_name(db, merchant.id, product_name)
                    if existing:
                        # Product exists — just add stock (restocking)
                        if quantity:
                            from models.inventory import Inventory
                            inv_result = await db.execute(select(Inventory).where(Inventory.product_id == existing.id))
                            inv = inv_result.scalar_one_or_none()
                            if inv:
                                inv.quantity = float(inv.quantity) + int(quantity)
                                new_total = float(inv.quantity)
                            else:
                                from models.inventory import Inventory as Inv
                                new_inv = Inv(product_id=existing.id, quantity=float(quantity))
                                db.add(new_inv)
                                new_total = float(quantity)
                            display_name = existing.name_fr if lang in ("fr", "en") and existing.name_fr else existing.name_ar
                            response_text = t("stock_updated", lang, name=display_name, qty=quantity, total=new_total)
                        else:
                            response_text = ai_result.get("response_text", "")
                    else:
                        # New product — create it
                        price_val = float(entities.get("price") or 0.0)
                        from models.product import Product as Prod
                        from models.inventory import Inventory as Inv
                        # Use name_fr for Latin-script names, name_ar for Arabic
                        is_latin = all(not ('\u0600' <= c <= '\u06FF') for c in product_name if c.isalpha())
                        new_product = Prod(
                            merchant_id=merchant.id,
                            name_ar=product_name,
                            name_fr=product_name,
                            unit=unit,
                            unit_price=price_val,
                            cost_price=price_val,
                        )
                        db.add(new_product)
                        await db.flush()
                        new_inv = Inv(product_id=new_product.id, quantity=float(quantity) if quantity else 0.0)
                        db.add(new_inv)
                        if price_val > 0:
                            response_text = t("product_added_with_price", lang, name=product_name, qty=quantity or 0, unit=unit, price=price_val)
                        else:
                            response_text = t("product_added_no_price", lang, name=product_name, qty=quantity or 0, unit=unit)
                else:
                    response_text = t("ask_product_name", lang)

            elif intent == "PRICE_UPDATE":
                product_name = entities.get("product_name", "")
                price = entities.get("price", 0)

                # If no product name in entities, scan conversation history for last product added/updated
                if not product_name and history:
                    markers = ["Produit ajoute:", "Product added:", "تمت الإضافة:", "Stock mis a jour:", "Stock updated:", "تم تحديث المخزون:"]
                    for msg in reversed(history):
                        content = msg.get("content", "")
                        if msg.get("role") == "assistant":
                            for marker in markers:
                                if marker in content:
                                    after = content.split(marker, 1)[1].strip()
                                    product_name = after.split("\n")[0].split("+")[0].strip()
                                    break
                        if product_name:
                            break

                if product_name and price:
                    product = await find_product_by_name(db, merchant.id, product_name)
                    if product:
                        product.unit_price = float(price)
                        product.cost_price = float(price)
                        display_name = product.name_fr if lang in ("fr", "en") and product.name_fr else product.name_ar
                        response_text = t("price_updated", lang, name=display_name, price=float(price))
                    else:
                        response_text = t("product_not_found", lang, name=product_name)
                elif price and not product_name:
                    response_text = t("price_which_product", lang)
                else:
                    response_text = ai_result.get("response_text", "")

            elif intent == "GET_REPORT":
                low_stock = await get_low_stock_products(db, merchant.id)
                if low_stock:
                    lines = [t("low_stock_header", lang)]
                    for item in low_stock:
                        lines.append(f"- {item['product_name']}: {item['quantity']} (seuil: {item['threshold']})")
                    response_text = "\n".join(lines)
                else:
                    response_text = t("stock_ok", lang)

            elif intent == "PLACE_ORDER":
                product_name = entities.get("product_name", "")
                quantity = entities.get("quantity", 0)
                if product_name and quantity:
                    product = await find_product_by_name(db, merchant.id, product_name)
                    if product:
                        from models.supplier import Supplier
                        from models.supplier_order import SupplierOrder, SupplierOrderStatus
                        sup_result = await db.execute(
                            select(Supplier).where(Supplier.is_active == True)
                        )
                        suppliers = sup_result.scalars().all()
                        matching = None
                        for s in suppliers:
                            if s.product_ids and product.id in s.product_ids:
                                matching = s
                                break
                        if matching:
                            order = SupplierOrder(
                                merchant_id=merchant.id,
                                supplier_id=matching.id,
                                items=[{"product_id": product.id, "product_name": product.name_ar, "quantity": int(quantity), "unit_price": float(product.cost_price)}],
                                total_amount=int(quantity) * float(product.cost_price),
                                status=SupplierOrderStatus.PENDING,
                            )
                            db.add(order)
                            response_text = f"Commande creee: {quantity} {product.name_ar} chez {matching.name}\nTotal: {order.total_amount:.2f} MAD"
                        else:
                            response_text = f"Aucun fournisseur trouve pour {product.name_ar}. Ajoutez un fournisseur dans le dashboard."

            # Save assistant response
            await save_message(db, merchant.id, MessageRole.ASSISTANT, response_text, intent=intent)
            await db.commit()

        if response_text:
            await send_text_message(phone_number, response_text)
    finally:
        await engine.dispose()

    return {"status": "processed", "intent": intent}


# ---- Low Stock Alerts ----

@celery_app.task(name="send_low_stock_alerts")
def send_low_stock_alerts():
    return run_async(_send_alerts())


async def _send_alerts():
    engine, SessionLocal = get_async_session()
    try:
        async with SessionLocal() as db:
            result = await db.execute(select(Merchant).where(Merchant.is_active == True))
            merchants = result.scalars().all()
            for merchant in merchants:
                low_stock = await get_low_stock_products(db, merchant.id)
                if low_stock:
                    lines = ["Alerte stock bas:"]
                    for item in low_stock:
                        lines.append(f"- {item['product_name']}: {item['quantity']}")
                    await send_text_message(merchant.phone_number, "\n".join(lines))
    finally:
        await engine.dispose()
    return {"status": "alerts_sent"}


# ---- Weekly Summary ----

@celery_app.task(name="send_weekly_summary")
def send_weekly_summary():
    return run_async(_send_weekly_summary())


async def _send_weekly_summary():
    engine, SessionLocal = get_async_session()
    try:
        async with SessionLocal() as db:
            result = await db.execute(select(Merchant).where(Merchant.is_active == True))
            merchants = result.scalars().all()

            for merchant in merchants:
                now = datetime.now(timezone.utc)
                week_start = now - timedelta(days=7)

                txn_result = await db.execute(
                    select(Transaction).where(
                        Transaction.merchant_id == merchant.id,
                        Transaction.type == TransactionType.SALE,
                        Transaction.created_at >= week_start,
                    )
                )
                txns = txn_result.scalars().all()
                total_sales = len(txns)
                total_revenue = sum(float(t.total_amount) for t in txns)

                prior_start = week_start - timedelta(days=7)
                prior_result = await db.execute(
                    select(Transaction).where(
                        Transaction.merchant_id == merchant.id,
                        Transaction.type == TransactionType.SALE,
                        Transaction.created_at >= prior_start,
                        Transaction.created_at < week_start,
                    )
                )
                prior_txns = prior_result.scalars().all()
                prior_revenue = sum(float(t.total_amount) for t in prior_txns)
                growth = ((total_revenue - prior_revenue) / prior_revenue * 100) if prior_revenue > 0 else 0

                product_sales = {}
                for t in txns:
                    name = t.product_id
                    product_sales[name] = product_sales.get(name, 0) + float(t.total_amount)

                low_stock = await get_low_stock_products(db, merchant.id)

                growth_sign = "+" if growth >= 0 else ""
                lines = [
                    "Resume hebdomadaire Souk.AI",
                    f"Periode: {week_start.strftime('%d/%m')} - {now.strftime('%d/%m/%Y')}",
                    "",
                    f"Ventes: {total_sales}",
                    f"Revenu: {total_revenue:.2f} MAD",
                    f"Croissance: {growth_sign}{growth:.1f}%",
                ]

                if low_stock:
                    lines.append("")
                    lines.append(f"Alertes stock ({len(low_stock)}):")
                    for item in low_stock[:5]:
                        lines.append(f"  - {item['product_name']}: {item['quantity']}")

                await send_text_message(merchant.phone_number, "\n".join(lines))
    finally:
        await engine.dispose()
    return {"status": "summaries_sent"}


# ---- Update Credit Scores ----

@celery_app.task(name="update_credit_scores")
def update_credit_scores():
    return run_async(_update_credit_scores())


async def _update_credit_scores():
    from services.credit_scoring import calculate_credit_score
    from models.credit import CreditHistory

    engine, SessionLocal = get_async_session()
    try:
        async with SessionLocal() as db:
            result = await db.execute(select(Merchant).where(Merchant.is_active == True))
            merchants = result.scalars().all()

            for merchant in merchants:
                score_data = await calculate_credit_score(db, merchant.id)
                merchant.credit_score = score_data["score"]
                history = CreditHistory(
                    merchant_id=merchant.id,
                    score=score_data["score"],
                    factors=score_data["factors"],
                )
                db.add(history)

            await db.commit()
    finally:
        await engine.dispose()
    return {"status": "scores_updated"}


# ---- Update Forecasts ----

@celery_app.task(name="update_forecasts")
def update_forecasts():
    return run_async(_update_forecasts())


async def _update_forecasts():
    from services.forecasting import calculate_forecast
    from models.forecast import Forecast

    engine, SessionLocal = get_async_session()
    try:
        async with SessionLocal() as db:
            result = await db.execute(select(Merchant).where(Merchant.is_active == True))
            merchants = result.scalars().all()

            for merchant in merchants:
                products_result = await db.execute(
                    select(Product).where(Product.merchant_id == merchant.id, Product.is_active == True)
                )
                for product in products_result.scalars().all():
                    forecasts = await calculate_forecast(db, merchant.id, product.id)
                    for f in forecasts:
                        fc = Forecast(
                            merchant_id=merchant.id,
                            product_id=product.id,
                            forecast_date=f["date"],
                            predicted_demand=f["demand"],
                            confidence_lower=f["lower"],
                            confidence_upper=f["upper"],
                            restock_recommendation=0,
                            factors=f.get("factors"),
                        )
                        db.add(fc)
                await db.commit()
    finally:
        await engine.dispose()
    return {"status": "forecasts_updated"}
