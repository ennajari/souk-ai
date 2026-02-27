import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from workers.celery_app import celery_app
from app.config import settings
from models.merchant import Merchant
from models.product import Product
from services.ai_engine import process_message
from services.whatsapp import send_text_message
from services.inventory import find_product_by_name, record_sale, get_stock_level, get_low_stock_products


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


@celery_app.task(name="process_whatsapp_message")
def process_whatsapp_message(phone_number: str, text: str):
    """Process incoming WhatsApp message with AI and update inventory."""
    return run_async(_process_message(phone_number, text))


async def _process_message(phone_number: str, text: str):
    # Analyze message with AI
    ai_result = await process_message(text)
    intent = ai_result.get("intent", "UNKNOWN")
    entities = ai_result.get("entities", {})
    response_text = ai_result.get("response_text", "")

    engine, SessionLocal = get_async_session()

    try:
        async with SessionLocal() as db:
            # Find merchant by phone
            result = await db.execute(select(Merchant).where(Merchant.phone_number == phone_number))
            merchant = result.scalar_one_or_none()

            if not merchant:
                await send_text_message(phone_number, "Bienvenue! Inscrivez-vous sur notre plateforme pour commencer.")
                return {"status": "unregistered"}

            if intent == "RECORD_SALE":
                product_name = entities.get("product_name", "")
                quantity = entities.get("quantity", 0)

                if product_name and quantity:
                    product = await find_product_by_name(db, merchant.id, product_name)
                    if product:
                        price = float(product.unit_price)
                        await record_sale(db, merchant.id, product.id, int(quantity), price)
                        await db.commit()

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

        # Send response via WhatsApp
        if response_text:
            await send_text_message(phone_number, response_text)
    finally:
        await engine.dispose()

    return {"status": "processed", "intent": intent}


@celery_app.task(name="send_low_stock_alerts")
def send_low_stock_alerts():
    """Check all merchants for low stock and send WhatsApp alerts."""
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
