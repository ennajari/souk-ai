"""Demo shop with 30 days of history, so every screen has something real to show.

    python -m scripts.seed_demo            # login 0600000001 / $DEMO_PASSWORD (default Demo-2026!)
                                           # wholesaler portal: 0600000002, same password

Idempotent: does nothing if the demo merchant already exists. Never run against production.
"""
import asyncio
import os
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, update

from app.config import settings
from core.database import AsyncSessionLocal
from core.security import hash_password
from models.customer import Customer
from models.inventory import Inventory
from models.merchant import Merchant
from models.merchant import AccountType
from models.product import Product
from models.supplier import Supplier
from models.supplier_catalog import SupplierCatalogItem
from models.supplier_order import SupplierOrder, SupplierOrderStatus
from models.transaction import Transaction
from services.credit_ledger import apply_entry
from services.sales import Line, record_items

PHONE = "212600000001"
WHOLESALER_PHONE = "212600000002"
# name_fr, name_ar, price, cost, opening stock, VAT %, daily demand, expiry in days (None = no expiry)
CATALOG = [
    ("Pain", "خبز", 1.5, 0.9, 60, None, 25, None),
    ("Lait 1L", "حليب", 7, 5.5, 20, 0, 6, 2),
    ("Yaourt nature", "ياغورت", 3, 2, 12, 0, 3, -1),
    ("Sucre 1kg", "سكر", 12, 9, 40, 0, 2, None),
    ("Huile 5L", "زيت", 95, 82, 8, 10, 0.4, None),
    ("Thé vert 200g", "أتاي", 18, 13, 20, 20, 1.5, None),
    ("Eau 1,5L", "ماء", 6, 4, 48, 20, 8, None),
    ("Soda 1L", "مشروب غازي", 10, 7, 4, 20, 3, None),
    ("Œufs (6)", "بيض", 9, 7, 15, 0, 2, 9),
    ("Farine 5kg", "دقيق", 32, 26, 10, 0, 0.5, None),
]


async def main() -> None:
    if settings.is_production:
        raise SystemExit("refusing to seed demo data in production")
    rng = random.Random(7)
    async with AsyncSessionLocal() as db:
        if (await db.execute(select(Merchant).where(Merchant.phone_number == PHONE))).scalar_one_or_none():
            print("demo merchant already exists")
            return
        m = Merchant(phone_number=PHONE, business_name="Hanout Demo", owner_name="Demo",
                     hashed_password=hash_password(os.getenv("DEMO_PASSWORD", "Demo-2026!")), preferred_language="FR")
        db.add(m)
        await db.flush()

        today = date.today()
        products = []
        for fr, ar, price, cost, stock, vat, demand, exp in CATALOG:
            p = Product(merchant_id=m.id, name_fr=fr, name_ar=ar, unit_price=price, cost_price=cost, tax_rate=vat,
                        expiry_date=today + timedelta(days=exp) if exp is not None else None)
            db.add(p)
            await db.flush()
            # enough stock for 30 days of history, minus a few best sellers left short to show stock-outs
            db.add(Inventory(product_id=p.id, quantity=stock + int(demand * 30 * 1.6) + 10))
            products.append((p, demand))
        await db.flush()

        # 30 days of sales with a weekend peak, recorded through the real sales service
        for day_ago in range(30, 0, -1):
            day = datetime.now(timezone.utc) - timedelta(days=day_ago)
            weekend = 1.3 if day.weekday() in (4, 5) else 1.0
            for p, demand in products:
                qty = sum(rng.random() < demand * weekend / 4 for _ in range(4)) if demand < 4 else \
                    max(0, int(rng.gauss(demand * weekend, demand * 0.25)))
                if qty:
                    [(txn, _)] = await record_items(db, m.id, [Line(product_id=p.id, quantity=qty, unit_price=p.unit_price)])
                    txn.created_at = day.replace(hour=rng.randint(8, 21), minute=rng.randint(0, 59))
        # leave the soda out of stock: the money report shows the margin it costs
        soda = next(p for p, _ in products if p.name_fr.startswith("Soda"))
        await db.execute(update(Inventory).where(Inventory.product_id == soda.id).values(quantity=0))

        for name, phone, amount, opt in (("Fatima Zahra", "0612345678", 119, True), ("Karim B.", "0623456789", 64, False)):
            c = Customer(merchant_id=m.id, name=name, phone=phone, credit_limit=500, whatsapp_opt_in=opt)
            db.add(c)
            await db.flush()
            apply_entry(db, c, m.id, "CREDIT", amount, "Courses du mois")
        # the dairy wholesaler is on Souk.AI too: linked record, a catalogue, one order waiting for them
        w = Merchant(phone_number=WHOLESALER_PHONE, business_name="Atlas Distribution", account_type=AccountType.SUPPLIER,
                     hashed_password=m.hashed_password, preferred_language="FR")
        db.add(w)
        await db.flush()
        sup = Supplier(merchant_id=m.id, name="Atlas Distribution", phone_number="0600000002", supplier_account_id=w.id)
        db.add(sup)
        await db.flush()
        for name, price in (("Lait 1L (carton de 12)", 62), ("Yaourt nature (x24)", 40), ("Œufs (plateau de 30)", 38)):
            db.add(SupplierCatalogItem(supplier_id=sup.id, name=name, unit="carton", unit_price=price))
        milk = next(p for p, _ in products if p.name_fr.startswith("Lait"))
        db.add(SupplierOrder(merchant_id=m.id, supplier_id=sup.id, status=SupplierOrderStatus.PENDING, total_amount=27 * 5.5,
                             items=[{"product_id": milk.id, "product_name": milk.name_fr, "quantity": 27, "unit_price": 5.5}]))
        await db.commit()
        n = len((await db.execute(select(Transaction.id).where(Transaction.merchant_id == m.id))).all())
        print(f"demo shop ready: {len(products)} products, {n} sale lines, login 0600000001, wholesaler 0600000002")


if __name__ == "__main__":
    asyncio.run(main())
