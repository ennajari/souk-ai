import json
from openai import AsyncOpenAI
from app.config import settings

SYSTEM_PROMPT = """Tu es un assistant IA pour Souk.AI, une plateforme de gestion d'inventaire pour les petits commercants marocains.

Tu comprends le Darija (dialecte marocain), le Tamazight (berbere), le francais et l'arabe standard.

Quand un merchant envoie un message, tu dois:
1. Identifier l'intention (intent)
2. Extraire les entites (produit, quantite, prix)

Reponds UNIQUEMENT en JSON valide avec cette structure:
{
  "intent": "RECORD_SALE" | "CHECK_STOCK" | "ADD_PRODUCT" | "GET_REPORT" | "PLACE_ORDER" | "GREETING" | "UNKNOWN",
  "entities": {
    "product_name": "nom du produit si mentionne",
    "quantity": nombre ou null,
    "unit": "kg" | "litre" | "piece" | "carton" | null,
    "price": nombre ou null
  },
  "confidence": 0.0 a 1.0,
  "response_text": "reponse naturelle en darija ou francais pour le merchant"
}

Exemples:
- "بعت 5 كيلو طماطم" -> RECORD_SALE, product=طماطم, qty=5, unit=kg
- "شحال بقى عندي فالسكر" -> CHECK_STOCK, product=سكر
- "اعطيني تقرير اليوم" -> GET_REPORT
- "بغيت نطلب 10 كراتن كوكا" -> PLACE_ORDER, product=كوكا, qty=10, unit=carton
- "سلام" -> GREETING

Si le message est en Tamazight (ex: ⵙⵍⴰⵎ, ⵎⴰⵏⵉⴽ ⵜⵍⵍⵉⴷ), comprends-le et reponds en Tamazight ou en Darija selon la preference du merchant.
"""


async def process_message(text: str, conversation_history: list[dict] | None = None) -> dict:
    """Process a merchant message using OpenAI API with optional conversation context."""
    if not settings.OPENAI_API_KEY:
        return {
            "intent": "UNKNOWN",
            "entities": {},
            "confidence": 0,
            "response_text": "Service AI non configure.",
        }

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if conversation_history:
        messages.extend(conversation_history)

    messages.append({"role": "user", "content": text})

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=500,
        messages=messages,
        temperature=0.1,
    )

    response_text = response.choices[0].message.content

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        return {
            "intent": "UNKNOWN",
            "entities": {},
            "confidence": 0,
            "response_text": response_text,
        }
