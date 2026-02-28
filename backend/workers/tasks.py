import asyncio
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

            if intent == "RECORD_SALE":
                product_name = entities.get("product_name", "")
                quantity = entities.get("quantity", 0)

                if product_name and quantity:
                    product = await find_product_by_name(db, merchant.id, product_name)
                    if product:
                        price = float(product.unit_price)
                        await record_sale(db, merchant.id, product.id, int(quantity), price, source=source)
                        stock = await get_stock_level(db, product.id)
                        response_text = (
                            f"Vente enregistree: {quantity} {product.name_ar}\n"
                            f"Total: {quantity * price:.2f} MAD\n"
                            f"Stock restant: {stock}"
                        )
                    else:
                        response_text = f"Produit '{product_name}' non trouve dans votre inventaire."

            elif intent == "CHECK_STOCK":
                product_name = entities.get("product_name", "")
                if product_name:
                    product = await find_product_by_name(db, merchant.id, product_name)
                    if product:
                        stock = await get_stock_level(db, product.id)
                        response_text = f"{product.name_ar}: {stock} {product.unit} en stock"
                    else:
                        response_text = f"Produit '{product_name}' non trouve."

            elif intent == "GET_REPORT":
                low_stock = await get_low_stock_products(db, merchant.id)
                if low_stock:
                    lines = ["Produits en stock bas:"]
                    for item in low_stock:
                        lines.append(f"- {item['product_name']}: {item['quantity']} (seuil: {item['threshold']})")
                    response_text = "\n".join(lines)
                else:
                    response_text = "Tous vos produits sont en stock suffisant."

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
