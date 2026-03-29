from fastapi import APIRouter

from api.v1 import auth, whatsapp, products, inventory, transactions, analytics, merchants, suppliers, credit, forecasts, sage, customers, export, notifications, coach, employees, catalogue, admin, marketplace, payments, market

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
api_router.include_router(sage.router)
api_router.include_router(customers.router)
api_router.include_router(export.router)
api_router.include_router(notifications.router)
api_router.include_router(coach.router)
api_router.include_router(employees.router)
api_router.include_router(catalogue.router)
api_router.include_router(admin.router)
api_router.include_router(marketplace.router)
api_router.include_router(payments.router)
api_router.include_router(market.router)
