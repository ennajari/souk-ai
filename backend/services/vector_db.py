import weaviate
from weaviate.classes.config import Configure, Property, DataType
import os
from typing import List, Dict, Any
from app.config import settings

def get_weaviate_client():
    weaviate_url = os.getenv("WEAVIATE_URL", "http://weaviate:8080")
    client = weaviate.connect_to_custom(
        http_host=weaviate_url.split("//")[1].split(":")[0],
        http_port=int(weaviate_url.split(":")[2]) if len(weaviate_url.split(":")) > 2 else 8080,
        http_secure=False,
        headers={
            "X-OpenAI-Api-Key": settings.OPENAI_API_KEY,
        }
    )
    return client

async def init_weaviate_schema():
    client = get_weaviate_client()
    try:
        if not client.collections.exists("Product"):
            client.collections.create(
                name="Product",
                vectorizer_config=Configure.Vectorizer.text2vec_openai(),
                properties=[
                    Property(name="product_id", data_type=DataType.TEXT),
                    Property(name="name_ar", data_type=DataType.TEXT),
                    Property(name="name_fr", data_type=DataType.TEXT),
                    Property(name="merchant_id", data_type=DataType.TEXT),
                ]
            )
    finally:
        client.close()

async def search_similar_products(query: str, merchant_id: str, limit: int = 3) -> List[Dict[str, Any]]:
    client = get_weaviate_client()
    try:
        products = client.collections.get("Product")
        # Ensure we only search products belonging to the merchant
        # or global products if we implement a global catalog later
        response = products.query.near_text(
            query=query,
            limit=limit,
        )
        results = []
        for obj in response.objects:
            if obj.properties.get("merchant_id") == merchant_id:
                results.append({
                    "product_id": obj.properties["product_id"],
                    "name_ar": obj.properties["name_ar"],
                    "name_fr": obj.properties["name_fr"],
                    "certainty": getattr(obj.metadata, 'certainty', 0.0)
                })
        return results
    except Exception as e:
        print(f"Weaviate search error: {e}")
        return []
    finally:
        client.close()

async def index_product(product_id: str, name_ar: str, name_fr: str, merchant_id: str):
    client = get_weaviate_client()
    try:
        products = client.collections.get("Product")
        products.data.insert(
            properties={
                "product_id": str(product_id),
                "name_ar": name_ar or "",
                "name_fr": name_fr or "",
                "merchant_id": str(merchant_id)
            }
        )
    finally:
        client.close()
