from fastapi import APIRouter

from api.v1 import auth, whatsapp, products, inventory, transactions, analytics, merchants, suppliers, credit, forecasts

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(whatsapp.router)
api_router.include_router(products.router)
api_router.include_router(inventory.router)
api_router.include_router(transactions.router)
api_router.include_router(analytics.router)
api_router.include_router(merchants.router)
api_router.include_router(suppliers.router)
api_router.include_router(credit.router)
api_router.include_router(forecasts.router)
