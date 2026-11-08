import asyncio
import os
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import random

from core.database import AsyncSessionLocal
from core.security import hash_password
from models.merchant import Merchant
from models.supplier import Supplier, SupplierCategory
from models.transaction import Transaction, TransactionType, TransactionSource
from models.product import Product

async def seed_data_for_test():
    """Seed the database with a test merchant, supplier, products, and transactions."""
    async with AsyncSessionLocal() as session:
        # Check if test merchant exists
        result = await session.execute(select(Merchant).where(Merchant.phone_number == "212600000000"))
        merchant = result.scalar_one_or_none()
        
        if not merchant:
            print("Creating test merchant...")
            merchant = Merchant(
                phone_number="212600000000",
                business_name="Test Hanout",
                owner_name="Ahmed",
                # Known demo password (override with DEMO_PASSWORD); never use this account in production
                hashed_password=hash_password(os.getenv("DEMO_PASSWORD", "demo-souk-2026")),
                email="test@hanout.ma",
                credit_score=500,
                is_active=True
            )
            session.add(merchant)
            await session.commit()
            
        print(f"Merchant ID: {merchant.id}")

        # Check if test supplier exists
        result = await session.execute(select(Supplier).where(Supplier.name == "Centrale Danone Test"))
        supplier = result.scalar_one_or_none()
        
        if not supplier:
            print("Creating test suppliers...")
            supplier = Supplier(
                name="Centrale Danone Test",
                category=SupplierCategory.DAIRY,
                contact_name="Distribution Casa",
                phone_number="0522000000",
                email="contact@danone-test.ma",
                minimum_order_value=500.0,
                is_active=True
            )
            session.add(supplier)
            
            supplier2 = Supplier(
                name="Coca Cola Test",
                category=SupplierCategory.BEVERAGES,
                contact_name="Distributeur",
                phone_number="0522111111",
                minimum_order_value=1000.0,
                is_active=True
            )
            session.add(supplier2)
            await session.commit()
            
        print(f"Supplier ID: {supplier.id}")
            
        # Add products
        result = await session.execute(select(Product).where(Product.merchant_id == merchant.id))
        products = result.scalars().all()
        
        if not products:
            print("Creating test products...")
            p1 = Product(
                merchant_id=merchant.id,
                name_ar="حليب سنترال",
                name_fr="Lait Centrale",
                cost_price=3.5,
                unit_price=4.0,
                barcode="1234567890",
                is_active=True
            )
            p2 = Product(
                merchant_id=merchant.id,
                name_ar="كوكا كولا",
                name_fr="Coca Cola",
                cost_price=5.0,
                unit_price=6.0,
                barcode="0987654321",
                is_active=True
            )
            session.add_all([p1, p2])
            await session.commit()
            # Link to suppliers
            supplier.product_ids = [p1.id]
            # supplier2.product_ids = [p2.id]
            await session.commit()
            products = [p1, p2]
            
        # Add some transactions for credit scoring
        result = await session.execute(select(Transaction).where(Transaction.merchant_id == merchant.id))
        txns = result.scalars().all()
        
        if not txns:
            print("Creating test transactions for credit scoring (last 30 days)...")
            now = datetime.now(timezone.utc)
            for i in range(25): # 25 sales
                random_days_ago = random.randint(1, 29)
                t = Transaction(
                    merchant_id=merchant.id,
                    product_id=products[0].id,
                    type=TransactionType.SALE,
                    source=TransactionSource.WHATSAPP,
                    quantity=random.randint(1, 10),
                    unit_price=4.0,
                    total_amount=random.randint(4, 40),
                    created_at=now - timedelta(days=random_days_ago)
                )
                session.add(t)
            await session.commit()

        print("Test data injected.")
        return merchant.phone_number

if __name__ == "__main__":
    asyncio.run(seed_data_for_test())
