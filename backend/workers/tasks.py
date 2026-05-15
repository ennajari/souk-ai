import asyncio
import base64
import json
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from workers.celery_app import celery_app
from app.config import settings
from models.merchant import Merchant
from models.product import Product
from models.transaction import Transaction, TransactionType, TransactionSource
from models.conversation import MessageRole, MessageType
from services.ai_engine import process_message, extract_invoice_data, generate_natural_response
from services.whatsapp import send_text_message
from services.inventory import find_product_by_name, find_most_similar_product, record_sale, get_stock_level, get_low_stock_products
from services.conversation import get_conversation_history, save_message
from services.speech_to_text import download_whatsapp_media, transcribe_audio

logger = logging.getLogger("souk_ai")


def detect_lang(text: str) -> str:
    """Return 'ar' if mostly Arabic/Darija, 'en' if clearly English, 'fr' otherwise."""
    arabic_chars = sum(1 for c in text if '؀' <= c <= 'ۿ')
    latin_chars = sum(1 for c in text if c.isalpha() and c.isascii())
    if arabic_chars > latin_chars:
        return "ar"
    lower = text.lower()
    en_phrases = {"i sold", "i received", "i bought", "how much do i", "i have in stock",
                  "show me all", "give me today", "my sales this", "hello i"}
    if any(phrase in lower for phrase in en_phrases):
        return "en"
    return "fr"


def detect_social_intent(text: str) -> str | None:
    """Detect social/casual messages that need warm human responses, not actions.
    Returns a social intent string or None if the message is task-oriented."""
    txt = text.strip().lower()
    txt_clean = txt.rstrip("!.?؟ ")

    thanks_patterns = [
        "merci", "mercy", "thanks", "thank you", "شكرا", "بارك الله",
        "choukran", "chokran", "sahit", "صحيت",
    ]
    ok_patterns = [
        "ok", "okay", "d'accord", "daccord", "parfait", "bien reçu",
        "bien recu", "c'est bon", "cbon", "top", "super", "cool",
        "واخا", "مزيان", "تمام", "حسنا", "ماشي مشكل",
        "entendu", "compris", "noté", "note", "got it", "alright",
    ]
    goodbye_patterns = [
        "bonne journée", "bonne journee", "bonne soirée", "bonne soiree",
        "bonne nuit", "au revoir", "à bientôt", "a bientot", "bye",
        "good night", "good bye", "goodbye", "تصبح على خير",
        "الله يحفظك", "بسلامة", "نهارك سعيد",
    ]
    encouragement_patterns = [
        "bravo", "génial", "genial", "excellent", "magnifique", "nickel",
        "formidable", "incroyable", "amazing", "great", "awesome",
    ]

    for p in thanks_patterns:
        if p in txt:
            return "SOCIAL_THANKS"
    for p in ok_patterns:
        if txt_clean == p or txt.startswith(p + " ") or txt.endswith(" " + p):
            return "SOCIAL_OK"
    for p in goodbye_patterns:
        if p in txt:
            return "SOCIAL_GOODBYE"
    for p in encouragement_patterns:
        if p in txt:
            return "SOCIAL_ENCOURAGEMENT"
    return None


def get_social_response(social_intent: str, lang: str, merchant_name: str = "") -> str:
    """Return a warm, human response for social/casual messages."""
    import random
    first_name = merchant_name.split()[0] if merchant_name.strip() else ""

    responses = {
        "SOCIAL_THANKS": {
            "fr": [
                "Avec plaisir ! N'hésitez pas si vous avez besoin de quoi que ce soit.",
                "De rien ! Bonne continuation et bonnes ventes !",
                "Je vous en prie ! Je suis là si besoin.",
            ],
            "ar": [
                "بلا جميل! أنا هنا إلا احتجتي شي حاجة.",
                "لا شكر على واجب! بالتوفيق في المبيعات!",
                "العفو! ديما هنا باش نعاونك.",
            ],
            "en": [
                "You're welcome! Let me know if you need anything.",
                "No problem! Happy selling!",
                "My pleasure! I'm here whenever you need me.",
            ],
        },
        "SOCIAL_OK": {
            "fr": [
                "Parfait ! Dites-moi quand vous voulez, je suis disponible.",
                "Super ! N'hésitez pas si vous avez besoin d'autre chose.",
                "Bien noté ! Je suis là.",
            ],
            "ar": [
                "تمام! غير قولي فاش تحتاجني.",
                "مزيان! أنا هنا ديما.",
                "واخا! إلا بغيتي شي حاجة أنا موجود.",
            ],
            "en": [
                "Great! Just let me know when you need me.",
                "Got it! I'm here whenever you're ready.",
                "Perfect! Don't hesitate to reach out.",
            ],
        },
        "SOCIAL_GOODBYE": {
            "fr": [
                "Bonne journée et bonnes ventes !",
                "À bientôt ! Prenez soin de vous.",
                "Bonne continuation ! Je suis là demain aussi.",
            ],
            "ar": [
                "نهارك سعيد! بالتوفيق في البيع!",
                "الله يعطيك الخير! نتلاقاو.",
                "بسلامة! غدا أنا هنا تاني.",
            ],
            "en": [
                "Have a great day! Happy selling!",
                "See you soon! Take care.",
                "Goodbye! I'll be here whenever you need me.",
            ],
        },
        "SOCIAL_ENCOURAGEMENT": {
            "fr": [
                "Merci ! On continue comme ça !",
                "C'est gentil ! Ensemble on avance !",
            ],
            "ar": [
                "شكرا! كنكملو هكا!",
                "الله يبارك! ديما للأمام!",
            ],
            "en": [
                "Thanks! Let's keep it going!",
                "Appreciate it! Onward and upward!",
            ],
        },
    }

    lang_responses = responses.get(social_intent, {}).get(lang, responses.get(social_intent, {}).get("fr", ["Bien reçu !"]))
    resp = random.choice(lang_responses)
    if first_name and random.random() < 0.4:
        if lang == "ar":
            resp = first_name + "، " + resp
        else:
            resp = first_name + ", " + resp[0].lower() + resp[1:]
    return resp
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
            "ar": "{name}: {stock} {unit}",
            "fr": "{name}: {stock} {unit}",
            "en": "{name}: {stock} {unit}",
        },
        "product_added_with_price": {
            "ar": "✅ {name} | {qty} {unit} | {price:.2f} درهم",
            "fr": "✅ {name} | {qty} {unit} | {price:.2f} MAD",
            "en": "✅ {name} | {qty} {unit} | {price:.2f} MAD",
        },
        "product_added_no_price": {
            "ar": "✅ {name} | {qty} {unit}\nPrix? Ex: '10 DH'",
            "fr": "✅ {name} | {qty} {unit}\nPrix? Ex: '10 DH'",
            "en": "✅ {name} | {qty} {unit}\nPrice? Ex: '10 DH'",
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
        "dashboard_link": {
            "ar": "لوحة التحكم: {url}",
            "fr": "Tableau de bord: {url}",
            "en": "Dashboard: {url}",
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


# ---- PDF Invoice Generator ----

def _build_invoice_pdf(invoice_number: str, client_name: str, merchant_name: str,
                       items_with_prices: list, date_str: str) -> bytes:
    """Generate a professional PDF invoice using reportlab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm, mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    import io

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=1.5 * cm, bottomMargin=2 * cm,
    )

    # Color palette
    PRIMARY = colors.HexColor("#7c3aed")   # violet-600
    PRIMARY_DARK = colors.HexColor("#5b21b6")  # violet-800
    PRIMARY_LIGHT = colors.HexColor("#ede9fe")  # violet-100
    PRIMARY_BG = colors.HexColor("#f5f3ff")    # violet-50
    DARK = colors.HexColor("#1f2937")    # gray-800
    GREY = colors.HexColor("#6b7280")    # gray-500
    LIGHT_GREY = colors.HexColor("#f3f4f6")  # gray-100
    colors.HexColor("#059669")   # emerald-600

    # Styles
    h1 = ParagraphStyle("h1", fontSize=28, fontName="Helvetica-Bold", textColor=PRIMARY, alignment=TA_LEFT, spaceAfter=2)
    sub = ParagraphStyle("sub", fontSize=9, fontName="Helvetica", textColor=GREY, alignment=TA_LEFT, spaceAfter=0)
    normal = ParagraphStyle("normal", fontSize=10, fontName="Helvetica", textColor=DARK, spaceAfter=3, leading=14)
    label = ParagraphStyle("label", fontSize=8, fontName="Helvetica-Bold", textColor=GREY, spaceAfter=2)
    ParagraphStyle("right", fontSize=10, fontName="Helvetica", alignment=TA_RIGHT, textColor=DARK)
    footer_s = ParagraphStyle("footer", fontSize=8, fontName="Helvetica", textColor=GREY, alignment=TA_CENTER)

    elements = []

    # ── Header: Logo + Invoice number ──
    header_data = [
        [
            Paragraph("<b>SOUK.AI</b>", h1),
            Paragraph(
                f"<b>FACTURE</b><br/>"
                f"<font size=9 color='#6b7280'>N° {invoice_number}</font><br/>"
                f"<font size=9 color='#6b7280'>Date: {date_str}</font>",
                ParagraphStyle("inv_r", fontSize=14, fontName="Helvetica-Bold", textColor=PRIMARY, alignment=TA_RIGHT, leading=16)
            ),
        ],
    ]
    header_table = Table(header_data, colWidths=[9 * cm, 8 * cm])
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(header_table)
    elements.append(Paragraph("Gestion intelligente pour commercants marocains", sub))
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceAfter=12))

    # ── Vendor & Client info ──
    info_data = [
        [
            Paragraph("<font size=8 color='#6b7280'><b>VENDEUR</b></font>", label),
            Paragraph("<font size=8 color='#6b7280'><b>CLIENT</b></font>", label),
        ],
        [
            Paragraph(f"<b>{merchant_name}</b>", normal),
            Paragraph(f"<b>{client_name or 'Client'}</b>", normal),
        ],
    ]
    info_table = Table(info_data, colWidths=[8.5 * cm, 8.5 * cm])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, PRIMARY_LIGHT),
        ("PADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 6 * mm))

    # ── Products table ──
    header_row = [
        Paragraph("<b>PRODUIT</b>", ParagraphStyle("th", fontSize=9, fontName="Helvetica-Bold", textColor=colors.white)),
        Paragraph("<b>QTE</b>", ParagraphStyle("th2", fontSize=9, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>PRIX UNIT.</b>", ParagraphStyle("th3", fontSize=9, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("<b>TOTAL</b>", ParagraphStyle("th4", fontSize=9, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_RIGHT)),
    ]
    rows = [header_row]
    grand_total = 0.0

    for idx, item in enumerate(items_with_prices):
        qty = float(item.get("quantity", 1))
        price = float(item.get("unit_price", 0))
        subtotal = qty * price
        grand_total += subtotal
        unit = item.get("unit", "pcs")
        row_style = ParagraphStyle(f"row_{idx}", fontSize=10, fontName="Helvetica", textColor=DARK)
        rows.append([
            Paragraph(f"{item.get('name', '')}", row_style),
            Paragraph(f"{qty:.0f} {unit}", ParagraphStyle(f"c_{idx}", alignment=TA_CENTER, fontSize=10, fontName="Helvetica", textColor=DARK)),
            Paragraph(f"{price:.2f}", ParagraphStyle(f"r_{idx}", alignment=TA_RIGHT, fontSize=10, fontName="Helvetica", textColor=DARK)),
            Paragraph(f"{subtotal:.2f}", ParagraphStyle(f"r2_{idx}", alignment=TA_RIGHT, fontSize=10, fontName="Helvetica-Bold", textColor=DARK)),
        ])

    # Subtotal + Total rows
    rows.append([
        "", "",
        Paragraph("<b>SOUS-TOTAL</b>", ParagraphStyle("subtot", fontName="Helvetica-Bold", fontSize=9, alignment=TA_RIGHT, textColor=GREY)),
        Paragraph(f"<b>{grand_total:.2f} MAD</b>", ParagraphStyle("subtot2", fontName="Helvetica-Bold", fontSize=10, alignment=TA_RIGHT, textColor=DARK)),
    ])
    rows.append([
        "", "",
        Paragraph("<b>TOTAL TTC</b>", ParagraphStyle("tot", fontName="Helvetica-Bold", fontSize=11, alignment=TA_RIGHT, textColor=PRIMARY_DARK)),
        Paragraph(f"<b>{grand_total:.2f} MAD</b>", ParagraphStyle("tot2", fontName="Helvetica-Bold", fontSize=12, alignment=TA_RIGHT, textColor=PRIMARY)),
    ])

    prod_table = Table(rows, colWidths=[8 * cm, 2.5 * cm, 3 * cm, 3.5 * cm])
    prod_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
        # Data rows: alternating background
        ("ROWBACKGROUNDS", (0, 1), (-1, -3), [colors.white, LIGHT_GREY]),
        # Grid for data rows only
        ("GRID", (0, 0), (-1, -3), 0.5, colors.HexColor("#e5e7eb")),
        # Subtotal separator
        ("LINEABOVE", (0, -2), (-1, -2), 0.5, colors.HexColor("#d1d5db")),
        # Total separator
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, PRIMARY),
        ("BACKGROUND", (2, -1), (-1, -1), PRIMARY_BG),
        # General
        ("PADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(prod_table)
    elements.append(Spacer(1, 1 * cm))

    # ── Payment info ──
    elements.append(Paragraph(
        "<b>Conditions:</b> Paiement a reception | Devise: MAD (Dirham Marocain)",
        ParagraphStyle("conditions", fontSize=8, fontName="Helvetica", textColor=GREY),
    ))
    elements.append(Spacer(1, 1.2 * cm))

    # ── Footer ──
    elements.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_LIGHT, spaceAfter=8))
    elements.append(Paragraph(
        "Merci pour votre confiance!",
        ParagraphStyle("thanks", fontSize=10, fontName="Helvetica-Bold", textColor=PRIMARY, alignment=TA_CENTER, spaceAfter=4),
    ))
    elements.append(Paragraph(
        f"Souk.AI — Gestion Intelligente pour Commercants Marocains | {settings.FRONTEND_URL}",
        footer_s,
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()


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
    except Exception as e:
        logger.error(f"Voice download/transcription failed for {phone_number}: {e}")
        await send_text_message(phone_number, "Désolé, je n'ai pas pu comprendre le message vocal. Réessayez ou envoyez un texte.")
        return {"status": "transcription_failed"}

    if not text:
        await send_text_message(phone_number, "Désolé, je n'ai pas pu comprendre le message vocal. Réessayez ou envoyez un texte.")
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

            lang = detect_lang(caption) if caption else "fr"  # noqa: F841

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
                    max_tokens=2000,
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
                                    "You are analyzing a wholesale invoice or delivery note (Bon de Livraison) for a Moroccan merchant.\n"
                                    "Extract ALL products listed in this image.\n\n"
                                    "CRITICAL PARSING RULES for Moroccan wholesale invoices:\n"
                                    "1. Product names often contain pack format: 'NAME VOL*N' where *N = N units per carton\n"
                                    "   - 'COCA-COLA PET 1L*8' → name='COCA-COLA PET 1L', pack_size=8, unit='piece'\n"
                                    "   - 'FANTA 1.5L*6' → name='FANTA 1.5L', pack_size=6, unit='piece'\n"
                                    "   - 'POM S PET 1L*8' → name='POM S PET 1L', pack_size=8\n"
                                    "2. Quantity in invoice = number of CARTONS ordered\n"
                                    "   Total stock to add = cartons × pack_size\n"
                                    "   - '1L*8 x1' → 1 carton × 8 pieces = 8 total pieces\n"
                                    "   - '1.5L*6 x5' → 5 cartons × 6 pieces = 30 total pieces\n"
                                    "3. Price extraction:\n"
                                    "   - If carton price shown (e.g. 56.22 MAD for 8 pieces): unit_price = 56.22 / 8 = 7.03\n"
                                    "   - If unit price shown directly: use it as-is\n"
                                    "4. Unit detection from product name:\n"
                                    "   - Contains 'L' or 'ml' → 'piece' (it's a bottle)\n"
                                    "   - Contains 'KG' or 'G' → 'kg'\n"
                                    "   - No volume/weight → 'piece'\n"
                                    "5. Clean product name: REMOVE the '*N' pack notation from the name\n\n"
                                    "Return ONLY a JSON array, no markdown:\n"
                                    '[{"name": "COCA-COLA PET 1L", "quantity": 8, "unit_price": 7.03, "unit": "piece", "pack_size": 8, "carton_price": 56.22}]\n\n'
                                    "Fields:\n"
                                    "- name: clean product name WITHOUT *N suffix\n"
                                    "- quantity: TOTAL units = cartons × pack_size (integer)\n"
                                    "- unit_price: price per single unit in MAD (carton_price / pack_size), 0 if unknown\n"
                                    "- unit: 'piece', 'kg', or 'litre'\n"
                                    "- pack_size: units per carton (1 if not applicable)\n"
                                    "- carton_price: price per carton in MAD (0 if unknown)\n"
                                    "Respond ONLY with the JSON array."
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
                pack_size = int(item.get("pack_size", 1) or 1)
                carton_price = float(item.get("carton_price", 0) or 0)
                if not name:
                    continue

                # If unit_price not given but carton_price and pack_size are, calculate it
                if unit_price == 0 and carton_price > 0 and pack_size > 1:
                    unit_price = round(carton_price / pack_size, 2)

                existing = await find_product_by_name(db, merchant.id, name)
                if existing:
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
                    if unit_price > 0:
                        existing.cost_price = unit_price
                else:
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
                    pack_str = f" (carton×{pack_size})" if pack_size > 1 else ""
                    price_str = f" | {unit_price:.2f} MAD/u" if unit_price > 0 else " | ⚠️ Prix manquant"
                    added.append(f"✅ {name}{pack_str} x{qty:.0f}{price_str}")

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
            lines.append(f"🔗 {settings.FRONTEND_URL}")

            await send_text_message(phone_number, "\n".join(lines))
    finally:
        await engine.dispose()

    return {"status": "image_processed", "added": len(added), "updated": len(updated)}


# ---- WhatsApp Document (CSV) Import ----

@celery_app.task(name="process_whatsapp_document")
def process_whatsapp_document(phone_number: str, media_id: str, filename: str):
    """Process CSV document sent via WhatsApp (Sage 100 import)."""
    return run_async(_process_document(phone_number, media_id, filename))


async def _process_document(phone_number: str, media_id: str, filename: str):
    from services.sage_import import parse_sage_articles, detect_sage_file_type
    from models.inventory import Inventory

    engine, SessionLocal = get_async_session()

    try:
        # Download file
        file_bytes = await download_whatsapp_media(media_id)
        if not file_bytes:
            await send_text_message(phone_number, "Impossible de telecharger le fichier.")
            return {"status": "download_failed"}

        # Decode content
        content = None
        for encoding in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
            try:
                content = file_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue

        if not content:
            await send_text_message(phone_number, "Impossible de lire le fichier. Encodage non reconnu.")
            return {"status": "decode_failed"}

        # Detect file type
        file_type = detect_sage_file_type(content)
        if not file_type or file_type != 'articles':
            await send_text_message(
                phone_number,
                "Le fichier ne semble pas etre un export Sage 100 d'articles.\n"
                "Exportez depuis Sage: Fichier > Exporter > Articles > CSV"
            )
            return {"status": "unknown_format"}

        # Parse articles
        articles = parse_sage_articles(content)
        if not articles:
            await send_text_message(phone_number, "Aucun article trouve dans le fichier CSV.")
            return {"status": "no_articles"}

        async with SessionLocal() as db:
            result = await db.execute(select(Merchant).where(Merchant.phone_number == phone_number))
            merchant = result.scalar_one_or_none()

            if not merchant:
                await send_text_message(phone_number, "Inscrivez-vous d'abord sur Souk.AI.")
                return {"status": "unregistered"}

            added = []
            updated = []
            for art in articles:
                name = art.get('name', '')
                existing = None

                if art.get('barcode'):
                    r = await db.execute(
                        select(Product).where(
                            Product.merchant_id == merchant.id,
                            Product.barcode == art['barcode'],
                            Product.is_active == True,
                        )
                    )
                    existing = r.scalar_one_or_none()

                if not existing:
                    r = await db.execute(
                        select(Product).where(
                            Product.merchant_id == merchant.id,
                            (Product.name_fr == name) | (Product.name_ar == name),
                            Product.is_active == True,
                        )
                    )
                    existing = r.scalar_one_or_none()

                if existing:
                    if art.get('unit_price'):
                        existing.unit_price = art['unit_price']
                    if art.get('cost_price'):
                        existing.cost_price = art['cost_price']
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

        # Send result
        lines = [f"Import Sage 100 termine! ({filename})"]
        lines.append(f"Total: {len(articles)} articles lus")
        if added:
            lines.append(f"+{len(added)} ajoutes: {', '.join(added[:5])}")
            if len(added) > 5:
                lines.append(f"  ...et {len(added)-5} de plus")
        if updated:
            lines.append(f"{len(updated)} mis a jour: {', '.join(updated[:5])}")
            if len(updated) > 5:
                lines.append(f"  ...et {len(updated)-5} de plus")
        if not added and not updated:
            lines.append("Aucun changement effectue.")

        await send_text_message(phone_number, "\n".join(lines))

    finally:
        await engine.dispose()

    return {"status": "imported", "added": len(added), "updated": len(updated)}


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

            lang = detect_lang(text)
            merchant_name = merchant.owner_name or merchant.business_name or ""

            # SOCIAL INTENT: detect casual messages before calling AI
            social = detect_social_intent(text)
            if social:
                response_text = get_social_response(social, lang, merchant_name)
                await save_message(db, merchant.id, MessageRole.USER, text, message_type)
                await save_message(db, merchant.id, MessageRole.ASSISTANT, response_text, intent=social)
                await db.commit()
                await send_text_message(phone_number, response_text)
                return {"status": "processed", "intent": social}

            # Load conversation context
            history = await get_conversation_history(db, merchant.id)

            # Save user message
            await save_message(db, merchant.id, MessageRole.USER, text, message_type)

            # Analyze with AI (with context)
            try:
                ai_raw = await process_message(text, conversation_history=history)
            except Exception as e:
                logger.error(f"AI engine failed for {phone_number}: {e}")
                await send_text_message(phone_number, "Désolé, un problème technique est survenu. Réessayez dans un instant.")
                return {"status": "ai_error"}

            ai_results = ai_raw if isinstance(ai_raw, list) else [ai_raw]

            ai_result = ai_results[0]
            intent = ai_result.get("intent", "UNKNOWN")
            entities = ai_result.get("entities", {})
            response_text = ai_result.get("response_text", "")

            source = TransactionSource.VOICE if message_type == MessageType.VOICE else TransactionSource.WHATSAPP

            # Keyword fallback: if UNKNOWN but message is about stock alerts/report, force GET_REPORT
            if intent == "UNKNOWN":
                txt_lower = text.lower()
                report_keywords = [
                    "alert", "alter", "rapport", "report", "bilan", "stock bas", "stock faible",
                    "ناقص", "تسالي", "قليل", "قليلة", "المخزون", "alertes", "منخفض",
                    "running low", "low stock", "what's low", "koi les", "شنو ناقص",
                    "المواد القاص", "مواد قليل", "ريبور",
                ]
                dashboard_keywords = [
                    "dashboard", "dashborad", "tableau de bord", "tableau bord", "lien",
                    "لوحة التحكم", "لوحة", "link", "url", "site", "application", "app",
                    "connecter", "connexion", "acceder", "accès", "ouvrir", "open",
                ]
                invoice_keywords = [
                    "facture", "invoice", "facteur", "fatura", "فاتورة", "client ",
                    "generer facture", "creer facture", "faire facture",
                ]
                sales_keywords = [
                    "vendu", "ventes", "chiffre", "revenue", "revenu", "combien j'ai vendu",
                    "mes ventes", "بعت", "شحال بعت", "sold", "sales", "how much did i sell",
                ]
                list_keywords = [
                    "liste", "produits", "mon stock", "mes produits", "quoi commander",
                    "المنتجات", "المخزون", "ليست", "عندي فال", "all products", "my products",
                    "show stock", "recommander", "recommend",
                ]
                greeting_keywords = [
                    "bonjour", "bonsoir", "salut", "salam", "slm", "hello", "hi ", "hey",
                    "السلام", "سلام", "مرحبا", "صباح", "مساء", "ⵙⵍⴰⵎ",
                    "bsr", "bjr", "coucou", "yo ", "slt",
                ]
                password_reset_keywords = [
                    "mot de passe", "password", "oublie", "oublié", "reset", "reinitialis",
                    "mdp", "code reset", "code reinitialisation", "code réinitialisation",
                    "كلمة السر", "نسيت", "باسوورد", "code", "كود",
                ]
                if any(kw in txt_lower or txt_lower == kw.strip() for kw in greeting_keywords):
                    intent = "GREETING"
                elif any(kw in txt_lower for kw in password_reset_keywords):
                    intent = "RESET_PASSWORD_BOT"
                elif any(kw in txt_lower for kw in sales_keywords):
                    intent = "SALES_REPORT"
                elif any(kw in txt_lower for kw in list_keywords):
                    intent = "LIST_PRODUCTS"
                elif any(kw in txt_lower for kw in report_keywords):
                    intent = "GET_REPORT"
                elif any(kw in txt_lower for kw in dashboard_keywords):
                    intent = "DASHBOARD_LINK"
                elif any(kw in txt_lower for kw in invoice_keywords):
                    intent = "CREATE_INVOICE"

            if intent == "RECORD_SALE":
                product_name = entities.get("product_name", "")
                quantity = entities.get("quantity", 0)

                if product_name and quantity:
                    product = await find_product_by_name(db, merchant.id, product_name)
                    if not product:
                        # Smart fallback: auto-match closest product if confident enough
                        similar, score = await find_most_similar_product(db, merchant.id, product_name)
                        if similar and score >= 0.35:
                            product = similar
                    if product:
                        price = float(product.unit_price)
                        await record_sale(db, merchant.id, product.id, int(quantity), price, source=source)
                        stock = await get_stock_level(db, product.id)
                        display_name = product.name_fr if lang in ("fr", "en") and product.name_fr else product.name_ar
                        data_ctx = (
                            "Vente enregistree: " + str(quantity) + " " + str(product.unit) +
                            " de " + str(display_name) + " — " + str(round(quantity * price, 2)) + " MAD." +
                            " Stock restant: " + str(stock) + " " + str(product.unit) + "."
                        )
                        response_text = await generate_natural_response(text, data_ctx, lang, history)
                    else:
                        # No match at all — list available products to help user
                        from sqlalchemy import select as sa_select
                        from models.product import Product as ProductModel
                        all_r = await db.execute(
                            sa_select(ProductModel).where(
                                ProductModel.merchant_id == merchant.id,
                                ProductModel.is_active == True,
                            ).limit(8)
                        )
                        avail = all_r.scalars().all()
                        if avail:
                            names = ", ".join(p.name_fr or p.name_ar for p in avail)
                            msgs_nf = {
                                "fr": "Produit introuvable. Produits disponibles: " + names,
                                "en": "Product not found. Available: " + names,
                                "ar": "المنتج غير موجود. المنتجات المتاحة: " + names,
                            }
                            response_text = msgs_nf.get(lang, msgs_nf["fr"])
                        else:
                            response_text = t("product_not_found", lang, name=product_name)

            elif intent == "CHECK_STOCK":
                product_name = entities.get("product_name", "")
                if product_name:
                    product = await find_product_by_name(db, merchant.id, product_name)
                    if product:
                        stock = await get_stock_level(db, product.id)
                        display_name = product.name_fr if lang in ("fr", "en") and product.name_fr else product.name_ar
                        price_str = f"{float(product.unit_price):.2f} MAD" if product.unit_price else "prix non defini"
                        data_ctx = "Produit: " + str(display_name) + chr(10) + "Stock: " + str(stock) + " " + str(product.unit) + chr(10) + "Prix: " + price_str
                        response_text = await generate_natural_response(text, data_ctx, lang, history)
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
                                inv.quantity = float(inv.quantity) + float(quantity)
                                new_total = float(inv.quantity)
                            else:
                                from models.inventory import Inventory as Inv
                                new_inv = Inv(product_id=existing.id, quantity=float(quantity))
                                db.add(new_inv)
                                new_total = float(quantity)
                            display_name = existing.name_fr if lang in ("fr", "en") and existing.name_fr else existing.name_ar
                            price_info = (f", prix: {float(existing.unit_price):.2f} MAD/{existing.unit}") if existing.unit_price else ""
                            data_ctx = (
                                "Reapprovisionnement enregistre: +" + str(quantity) + " " + str(existing.unit) +
                                " de " + str(display_name) + price_info +
                                ". Stock total: " + str(new_total) + " " + str(existing.unit) + "."
                            )
                            response_text = await generate_natural_response(text, data_ctx, lang, history)
                        else:
                            response_text = ai_result.get("response_text", "")
                    else:
                        # New product — create it
                        price_val = float(entities.get("price") or 0.0)
                        from models.product import Product as Prod
                        from models.inventory import Inventory as Inv
                        is_arabic = any("؀" <= c <= "ۿ" for c in product_name if c.isalpha())
                        new_product = Prod(
                            merchant_id=merchant.id,
                            name_ar=product_name if is_arabic else "",
                            name_fr="" if is_arabic else product_name,
                            unit=unit,
                            unit_price=price_val,
                            cost_price=price_val,
                        )
                        db.add(new_product)
                        await db.flush()
                        new_inv = Inv(product_id=new_product.id, quantity=float(quantity) if quantity else 0.0)
                        db.add(new_inv)
                        price_info = f", prix: {price_val:.2f} MAD/{unit}" if price_val > 0 else " (prix a definir)"
                        data_ctx = (
                            "Nouveau produit cree: " + product_name +
                            " — " + str(quantity or 0) + " " + unit + price_info + "."
                        )
                        response_text = await generate_natural_response(text, data_ctx, lang, history)
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
                dashboard_url = settings.FRONTEND_URL
                if low_stock:
                    data_lines = ["Stock bas detecte (" + str(len(low_stock)) + " produit(s)):"]
                    for item in low_stock:
                        data_lines.append("- " + item["product_name"] + ": " + str(item["quantity"]) + " (seuil: " + str(item["threshold"]) + ")")
                    data_lines.append("Dashboard: " + dashboard_url)
                    data_ctx = chr(10).join(data_lines)
                    response_text = await generate_natural_response(text, data_ctx, lang, history)
                else:
                    data_ctx = "Tous les stocks sont OK, aucun produit en alerte. Dashboard: " + dashboard_url
                    response_text = await generate_natural_response(text, data_ctx, lang, history)
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

            elif intent == "SALES_REPORT":
                product_name = entities.get("product_name", "")
                period = entities.get("period", "week") or "week"
                now = datetime.now(timezone.utc)
                if period == "today":
                    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                    period_label = {"ar": "اليوم", "fr": "aujourd'hui", "en": "today"}
                elif period == "month":
                    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                    period_label = {"ar": "هاد الشهر", "fr": "ce mois", "en": "this month"}
                else:
                    start = now - timedelta(days=7)
                    period_label = {"ar": "هاد الأسبوع", "fr": "cette semaine", "en": "this week"}

                query = select(Transaction).where(
                    Transaction.merchant_id == merchant.id,
                    Transaction.type == TransactionType.SALE,
                    Transaction.created_at >= start,
                )
                txn_result = await db.execute(query)
                txns = txn_result.scalars().all()

                if product_name:
                    product = await find_product_by_name(db, merchant.id, product_name)
                    if product:
                        product_txns = [tx for tx in txns if str(tx.product_id) == str(product.id)]
                        total_qty = sum(int(tx.quantity) for tx in product_txns)
                        total_rev = sum(float(tx.total_amount) for tx in product_txns)
                        display = product.name_fr if lang in ("fr", "en") and product.name_fr else product.name_ar
                        msgs = {
                            "ar": f"📊 *{display}* — {period_label['ar']}:\n🛒 الكمية: {total_qty}\n💰 الإيرادات: {total_rev:.2f} درهم",
                            "fr": f"📊 *{display}* — {period_label['fr']}:\n🛒 Quantite vendue: {total_qty}\n💰 Revenu: {total_rev:.2f} MAD",
                            "en": f"📊 *{display}* — {period_label['en']}:\n🛒 Qty sold: {total_qty}\n💰 Revenue: {total_rev:.2f} MAD",
                        }
                        response_text = msgs.get(lang, msgs["fr"])
                    else:
                        response_text = t("product_not_found", lang, name=product_name)
                else:
                    total_rev = sum(float(tx.total_amount) for tx in txns)
                    nb = len(txns)
                    # Top 5 products
                    product_rev = {}
                    for tx in txns:
                        product_rev[str(tx.product_id)] = product_rev.get(str(tx.product_id), 0) + float(tx.total_amount)
                    top_pids = sorted(product_rev, key=lambda x: product_rev[x], reverse=True)[:5]
                    top_lines = []
                    for pid in top_pids:
                        prod_r = await db.execute(select(Product).where(Product.id == pid))
                        prod = prod_r.scalar_one_or_none()
                        name = (prod.name_fr or prod.name_ar) if prod else pid
                        top_lines.append(f"  • {name}: {product_rev[pid]:.2f} MAD")
                    pl = period_label.get(lang, period_label["fr"])
                    header = {"ar": f"📊 *ملخص المبيعات* — {pl}", "fr": f"📊 *Resume des ventes* — {pl}", "en": f"📊 *Sales summary* — {pl}"}
                    lines = [header.get(lang, header["fr"])]
                    lines.append(f"🛒 {nb} vente(s)")
                    lines.append(f"💰 {total_rev:.2f} MAD")
                    if top_lines:
                        top_h = {"ar": "\n🏆 *أفضل المنتجات:*", "fr": "\n🏆 *Top produits:*", "en": "\n🏆 *Top products:*"}
                        lines.append(top_h.get(lang, top_h["fr"]))
                        lines.extend(top_lines)
                    lines.append(f"\n{t('dashboard_link', lang, url=settings.FRONTEND_URL)}")
                    response_text = "\n".join(lines)

            elif intent == "LIST_PRODUCTS":
                from models.inventory import Inventory
                prod_result = await db.execute(
                    select(Product).where(Product.merchant_id == merchant.id, Product.is_active == True)
                )
                all_products = prod_result.scalars().all()
                if not all_products:
                    msgs = {
                        "ar": "📦 ما عندك حتى منتج.",
                        "fr": "📦 Vous n'avez encore aucun produit. Envoyez 'j'ai recu 10 sucre' pour en ajouter.",
                        "en": "📦 No products yet. Send 'I received 10 sugar' to add one.",
                    }
                    response_text = msgs.get(lang, msgs["fr"])
                else:
                    data_lines = []
                    low_count = 0
                    for p in all_products[:25]:
                        inv_r = await db.execute(select(Inventory).where(Inventory.product_id == p.id))
                        inv = inv_r.scalar_one_or_none()
                        stock = float(inv.quantity) if inv else 0
                        threshold = float(inv.reorder_threshold) if inv and inv.reorder_threshold else 10
                        name = p.name_fr if lang in ("fr", "en") and p.name_fr else p.name_ar
                        price_str = f", {float(p.unit_price):.2f} MAD" if p.unit_price else ""
                        alert = " ⚠️" if stock <= threshold else ""
                        data_lines.append("- " + str(name) + ": " + str(int(stock)) + " " + str(p.unit) + price_str + alert)
                        if stock <= threshold:
                            low_count += 1
                    total = len(all_products)
                    data_ctx = "Nombre total de produits: " + str(total) + chr(10)
                    data_ctx += chr(10).join(data_lines)
                    if total > 25:
                        data_ctx += chr(10) + "... et " + str(total - 25) + " autres"
                    if low_count:
                        data_ctx += chr(10) + "ATTENTION: " + str(low_count) + " produit(s) en stock bas."
                    data_ctx += chr(10) + "Dashboard: " + settings.FRONTEND_URL
                    response_text = await generate_natural_response(text, data_ctx, lang, history)
            # For DASHBOARD_LINK: send direct URL
            if intent == "DASHBOARD_LINK":
                dashboard_url = settings.FRONTEND_URL
                msgs = {
                    "ar": f"🔗 لوحة التحكم الخاصة بك:\n{dashboard_url}\n\nيمكنك تسجيل الدخول برقم هاتفك وكلمة المرور.",
                    "fr": f"🔗 Votre tableau de bord:\n{dashboard_url}\n\nConnectez-vous avec votre numéro de téléphone et mot de passe.",
                    "en": f"🔗 Your dashboard:\n{dashboard_url}\n\nLogin with your phone number and password.",
                }
                response_text = msgs.get(lang, msgs["fr"])

            # For CREATE_INVOICE: extract items, generate PDF, send via WhatsApp
            if intent == "CREATE_INVOICE":
                invoice_data = await extract_invoice_data(text)
                client_name = invoice_data.get("client_name", "")
                raw_items = invoice_data.get("items", [])

                if not raw_items:
                    response_text = {
                        "ar": "❌ لم أتمكن من استخراج المنتجات من رسالتك. مثال: 'فاتورة لعميل أحمد: 5 زيت، 8 سردين'",
                        "fr": "❌ Je n'ai pas pu extraire les produits. Exemple: 'facture pour client Ahmed: 5 zite, 8 sardine'",
                        "en": "❌ Could not extract products. Example: 'invoice for client Ahmed: 5 oil, 8 sardines'",
                    }.get(lang, "❌ Produits introuvables dans le message.")
                else:
                    # Resolve prices from DB
                    items_with_prices = []
                    missing = []
                    for raw in raw_items:
                        pname = str(raw.get("name", "")).strip()
                        qty = float(raw.get("quantity", 1) or 1)
                        if not pname:
                            continue
                        product = await find_product_by_name(db, merchant.id, pname)
                        if product:
                            display = product.name_fr if lang in ("fr", "en") and product.name_fr else product.name_ar
                            items_with_prices.append({
                                "name": display,
                                "quantity": qty,
                                "unit_price": float(product.unit_price),
                                "unit": product.unit,
                            })
                        else:
                            items_with_prices.append({
                                "name": pname,
                                "quantity": qty,
                                "unit_price": 0.0,
                                "unit": "pcs",
                            })
                            missing.append(pname)

                    # Generate invoice PDF
                    from datetime import date as date_cls
                    invoice_number = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
                    date_str = date_cls.today().strftime("%d/%m/%Y")
                    merchant_name = getattr(merchant, "owner_name", None) or merchant.phone_number

                    pdf_bytes = _build_invoice_pdf(
                        invoice_number, client_name, merchant_name,
                        items_with_prices, date_str,
                    )

                    # Send PDF via WhatsApp
                    from services.whatsapp import send_document_message
                    filename = f"facture_{invoice_number}.pdf"
                    caption_map = {
                        "ar": f"🧾 فاتورة N°{invoice_number} — {client_name}",
                        "fr": f"🧾 Facture N°{invoice_number} — {client_name}",
                        "en": f"🧾 Invoice N°{invoice_number} — {client_name}",
                    }
                    await send_document_message(phone_number, pdf_bytes, filename, caption_map.get(lang, caption_map["fr"]))

                    # Confirmation text message
                    total = sum(float(i["quantity"]) * float(i["unit_price"]) for i in items_with_prices)
                    lines_ok = [f"  • {i['name']}: {i['quantity']:.0f} × {i['unit_price']:.2f} = {float(i['quantity'])*float(i['unit_price']):.2f} MAD"
                                for i in items_with_prices]
                    summary = {
                        "ar": f"✅ تم إنشاء الفاتورة!\nالعميل: {client_name}\n" + "\n".join(lines_ok) + f"\n💰 المجموع: {total:.2f} درهم",
                        "fr": f"✅ Facture générée!\nClient: {client_name}\n" + "\n".join(lines_ok) + f"\n💰 Total: {total:.2f} MAD",
                        "en": f"✅ Invoice generated!\nClient: {client_name}\n" + "\n".join(lines_ok) + f"\n💰 Total: {total:.2f} MAD",
                    }
                    response_text = summary.get(lang, summary["fr"])
                    if missing:
                        response_text += "\n⚠️ Prix non trouvé pour: " + ", ".join(missing)

            # ── RESET_PASSWORD_BOT: generate & send OTP inline ──────────────
            # The user initiated this conversation → no 24h window restriction.
            # Store code in Redis so the website /reset-confirm endpoint can verify it.
            if intent == "RESET_PASSWORD_BOT":
                import random as _random
                import redis.asyncio as _aioredis
                otp_code = str(_random.randint(100000, 999999))
                _r = _aioredis.from_url(settings.REDIS_URL, decode_responses=True)
                await _r.setex(f"otp:{phone_number}", 600, otp_code)
                await _r.aclose()
                msgs = {
                    "ar": (
                        f"🔑 كود إعادة تعيين كلمة السر ديالك:\n\n"
                        f"*{otp_code}*\n\n"
                        f"⏱ صالح 10 دقائق فقط.\n"
                        f"استخدمه في: {settings.FRONTEND_URL}/reset-password"
                    ),
                    "fr": (
                        f"🔑 Votre code de réinitialisation:\n\n"
                        f"*{otp_code}*\n\n"
                        f"⏱ Valide 10 minutes.\n"
                        f"Utilisez-le sur: {settings.FRONTEND_URL}/reset-password"
                    ),
                    "en": (
                        f"🔑 Your password reset code:\n\n"
                        f"*{otp_code}*\n\n"
                        f"⏱ Valid for 10 minutes.\n"
                        f"Use it at: {settings.FRONTEND_URL}/reset-password"
                    ),
                }
                response_text = msgs.get(lang, msgs["fr"])

            # For GREETING: warm welcome — show full menu only for first interaction
            if intent == "GREETING":
                dashboard_url = settings.FRONTEND_URL
                first_name = merchant_name.split()[0] if merchant_name.strip() else ""
                NL = chr(10)
                is_returning = len(history) > 2

                if is_returning:
                    # Short warm greeting for returning users
                    if lang == "ar":
                        response_text = "مرحبا" + (" " + first_name if first_name else "") + "! كيداير اليوم؟ شنو نقدر ندير ليك؟"
                    elif lang == "en":
                        response_text = "Hey" + (" " + first_name if first_name else "") + "! How's it going? What can I help you with?"
                    else:
                        response_text = "Bonjour" + (" " + first_name if first_name else "") + " ! Comment ça va ? Qu'est-ce que je peux faire pour vous ?"
                else:
                    # Full welcome with capabilities for new users
                    if lang == "ar":
                        response_text = (
                            "مرحبا" + (" " + first_name if first_name else "") + "! انا Souk.AI، المساعد الذكي ديالك." + NL + NL +
                            "شنو نقدر ندير ليك:" + NL +
                            "- سيفط vocal وانا نفهمك" + NL +
                            "- 'شحال بقى عندي فالسكر' - نشوف ليك المخزون" + NL +
                            "- 'بعت 5 كيلو طماطم' - نسجل ليك البيع" + NL +
                            "- 'عطيني ليست ديال المنتجات' - نبعت ليك كلشي" + NL +
                            "- 'فاتورة لعميل أحمد' - نخدم ليك PDF" + NL + NL +
                            "لوحة التحكم: " + dashboard_url
                        )
                    elif lang == "en":
                        response_text = (
                            "Hello" + (" " + first_name if first_name else "") + "! I'm Souk.AI, your smart assistant." + NL + NL +
                            "Here's what I can do:" + NL +
                            "- Send a voice message, I understand!" + NL +
                            "- 'how much sugar' - check your stock" + NL +
                            "- 'I sold 5 kg tomatoes' - record the sale" + NL +
                            "- 'my sales this week' - full summary" + NL +
                            "- 'list products' - all your stock" + NL +
                            "- 'invoice for client Ahmed' - PDF generated" + NL + NL +
                            "Dashboard: " + dashboard_url
                        )
                    else:
                        response_text = (
                            "Bonjour" + (" " + first_name if first_name else "") + " ! Je suis Souk.AI, votre assistant intelligent." + NL + NL +
                            "Voici ce que je peux faire :" + NL +
                            "- Envoyez un vocal, je comprends" + NL +
                            "- 'combien de sucre' - je vérifie le stock" + NL +
                            "- 'j'ai vendu 5 kg tomates' - j'enregistre la vente" + NL +
                            "- 'mes ventes cette semaine' - résumé complet" + NL +
                            "- 'liste de produits' - tout votre stock" + NL +
                            "- 'facture pour client Ahmed' - PDF généré" + NL + NL +
                            "Tableau de bord : " + dashboard_url
                        )
            # Handle additional products from multi-product messages (ai_results[1:])
            extra_parts = []
            for extra_ai in ai_results[1:]:
                ex_intent = extra_ai.get("intent", "UNKNOWN")
                ex_ent = extra_ai.get("entities", {})
                ex_pname = ex_ent.get("product_name", "")
                ex_qty = ex_ent.get("quantity", 0)
                ex_unit = ex_ent.get("unit", "piece") or "piece"
                ex_price_val = float(ex_ent.get("price") or 0.0)
                if not ex_pname:
                    continue
                if ex_intent == "ADD_PRODUCT":
                    ex_existing = await find_product_by_name(db, merchant.id, ex_pname)
                    if ex_existing:
                        if ex_qty:
                            from models.inventory import Inventory as _Inv
                            ex_inv_r = await db.execute(select(_Inv).where(_Inv.product_id == ex_existing.id))
                            ex_inv = ex_inv_r.scalar_one_or_none()
                            if ex_inv:
                                ex_inv.quantity = float(ex_inv.quantity) + float(ex_qty)
                                ex_total = float(ex_inv.quantity)
                            else:
                                ex_new_inv = _Inv(product_id=ex_existing.id, quantity=float(ex_qty))
                                db.add(ex_new_inv)
                                ex_total = float(ex_qty)
                            ex_dname = ex_existing.name_fr if lang in ("fr", "en") and ex_existing.name_fr else ex_existing.name_ar
                            ex_parts_ctx = "Reapprovisionnement: +" + str(ex_qty) + " " + str(ex_existing.unit) + " de " + str(ex_dname) + ". Stock total: " + str(ex_total) + " " + str(ex_existing.unit) + "."
                            ex_resp = await generate_natural_response(text, ex_parts_ctx, lang, history)
                            extra_parts.append(ex_resp)
                    else:
                        from models.product import Product as _Prod
                        from models.inventory import Inventory as _Inv2
                        ex_is_ar = any("؀" <= c <= "ۿ" for c in ex_pname if c.isalpha())
                        ex_prod = _Prod(merchant_id=merchant.id, name_ar=ex_pname if ex_is_ar else "", name_fr="" if ex_is_ar else ex_pname, unit=ex_unit, unit_price=ex_price_val, cost_price=ex_price_val)
                        db.add(ex_prod)
                        await db.flush()
                        db.add(_Inv2(product_id=ex_prod.id, quantity=float(ex_qty) if ex_qty else 0.0))
                        ex_pinfo = f", prix: {ex_price_val:.2f} MAD/{ex_unit}" if ex_price_val > 0 else " (prix a definir)"
                        ex_ctx = "Nouveau produit cree: " + ex_pname + " — " + str(ex_qty or 0) + " " + ex_unit + ex_pinfo + "."
                        ex_resp = await generate_natural_response(text, ex_ctx, lang, history)
                        extra_parts.append(ex_resp)
                elif ex_intent == "RECORD_SALE" and ex_qty:
                    ex_prod = await find_product_by_name(db, merchant.id, ex_pname)
                    if not ex_prod:
                        ex_sim, ex_sc = await find_most_similar_product(db, merchant.id, ex_pname)
                        if ex_sim and ex_sc >= 0.35:
                            ex_prod = ex_sim
                    if ex_prod:
                        ex_price = float(ex_prod.unit_price)
                        await record_sale(db, merchant.id, ex_prod.id, int(ex_qty), ex_price, source=source)
                        ex_stock = await get_stock_level(db, ex_prod.id)
                        ex_dname = ex_prod.name_fr if lang in ("fr", "en") and ex_prod.name_fr else ex_prod.name_ar
                        ex_ctx = "Vente enregistree: " + str(ex_qty) + " " + str(ex_prod.unit) + " de " + str(ex_dname) + " — " + str(round(ex_qty * ex_price, 2)) + " MAD. Stock restant: " + str(ex_stock) + " " + str(ex_prod.unit) + "."
                        ex_resp = await generate_natural_response(text, ex_ctx, lang, history)
                        extra_parts.append(ex_resp)
            if extra_parts:
                response_text = response_text + chr(10) + chr(10) + (chr(10) + chr(10)).join(extra_parts)

            # Save assistant response
            await save_message(db, merchant.id, MessageRole.ASSISTANT, response_text, intent=intent)
            await db.commit()

        if response_text:
            await send_text_message(phone_number, response_text)
    except Exception as e:
        logger.error(f"Message processing failed for {phone_number}: {e}", exc_info=True)
        try:
            await send_text_message(phone_number, "Désolé, une erreur est survenue. Réessayez dans un instant.")
        except Exception:
            pass
        return {"status": "error", "error": str(e)}
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
                lines = []

                # Low stock alerts
                low_stock = await get_low_stock_products(db, merchant.id)
                if low_stock:
                    lines.append("⚠️ *Stock bas:*")
                    for item in low_stock:
                        qty = item['quantity']
                        if qty <= 0:
                            lines.append(f"  🔴 {item['product_name']}: Rupture de stock")
                        else:
                            lines.append(f"  🟡 {item['product_name']}: {qty:.0f} restant(s) — pensez à réapprovisionner")

                # Expiry date alerts (within 7 days)
                from datetime import date as date_cls
                today = date_cls.today()
                deadline = today + timedelta(days=7)
                expiry_result = await db.execute(
                    select(Product).where(
                        Product.merchant_id == merchant.id,
                        Product.is_active == True,
                        Product.expiry_date != None,
                        Product.expiry_date <= deadline,
                    )
                )
                expiring = expiry_result.scalars().all()
                if expiring:
                    lines.append("\n📅 *Produits proches de l'expiration:*")
                    for p in expiring:
                        days_left = (p.expiry_date - today).days
                        name = p.name_fr or p.name_ar
                        if days_left <= 0:
                            lines.append(f"  🔴 {name}: EXPIRÉ le {p.expiry_date.strftime('%d/%m/%Y')}")
                        else:
                            lines.append(f"  🟡 {name}: expire dans {days_left} jour(s) ({p.expiry_date.strftime('%d/%m/%Y')})")

                if lines:
                    lines.append(f"\n🔗 {settings.FRONTEND_URL}")
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
                    pid = str(t.product_id)
                    prod_r = await db.execute(select(Product).where(Product.id == pid))
                    prod = prod_r.scalar_one_or_none()
                    name = (prod.name_fr or prod.name_ar) if prod else pid
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

                lines.append(f"\n🔗 Dashboard: {settings.FRONTEND_URL}")
                await send_text_message(merchant.phone_number, "\n".join(lines))
    finally:
        await engine.dispose()
    return {"status": "summaries_sent"}


# ---- Daily Sales Report (midnight) ----

@celery_app.task(name="send_daily_sales_report")
def send_daily_sales_report():
    return run_async(_send_daily_sales_report())


async def _send_daily_sales_report():
    engine, SessionLocal = get_async_session()
    try:
        async with SessionLocal() as db:
            result = await db.execute(select(Merchant).where(Merchant.is_active == True))
            merchants = result.scalars().all()

            for merchant in merchants:
                morocco_tz = timezone(timedelta(hours=1))
                now_morocco = datetime.now(morocco_tz)
                today_start = now_morocco.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)

                txn_result = await db.execute(
                    select(Transaction).where(
                        Transaction.merchant_id == merchant.id,
                        Transaction.type == TransactionType.SALE,
                        Transaction.created_at >= today_start,
                    )
                )
                txns = txn_result.scalars().all()

                if not txns:
                    continue

                total_revenue = sum(float(t.total_amount) for t in txns)
                nb_sales = len(txns)

                # Top products by revenue
                product_rev: dict = {}
                for t in txns:
                    pid = str(t.product_id)
                    product_rev[pid] = product_rev.get(pid, 0) + float(t.total_amount)
                top_pids = sorted(product_rev, key=lambda x: product_rev[x], reverse=True)[:5]

                top_lines = []
                for pid in top_pids:
                    prod_r = await db.execute(select(Product).where(Product.id == pid))
                    prod = prod_r.scalar_one_or_none()
                    name = (prod.name_fr or prod.name_ar) if prod else pid
                    top_lines.append(f"  • {name}: {product_rev[pid]:.2f} MAD")

                low_stock = await get_low_stock_products(db, merchant.id)

                date_str = now_morocco.strftime("%d/%m/%Y")
                lines = [
                    f"📊 *Rapport quotidien — {date_str}*",
                    "",
                    f"🛒 Ventes: {nb_sales}",
                    f"💰 Revenu: {total_revenue:.2f} MAD",
                    "",
                    "🏆 Top produits:",
                ] + top_lines

                if low_stock:
                    lines += ["", f"⚠️ Stock bas ({len(low_stock)}):"]
                    for item in low_stock[:3]:
                        qty = item['quantity']
                        if qty <= 0:
                            lines.append(f"  🔴 {item['product_name']}: Rupture de stock")
                        else:
                            lines.append(f"  🟡 {item['product_name']}: {qty:.0f} restant(s)")

                lines.append(f"\n💪 Bonne continuation et bonnes ventes demain !")
                lines.append(f"🔗 {settings.FRONTEND_URL}")
                await send_text_message(merchant.phone_number, "\n".join(lines))
    finally:
        await engine.dispose()
    return {"status": "daily_reports_sent"}


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
