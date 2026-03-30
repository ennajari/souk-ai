#!/usr/bin/env python3
"""
Souk.AI - Test complet de tous les endpoints API
Usage: python scripts/test_api.py [BASE_URL]
Défaut: http://localhost:8000
"""

import sys
import json
import time
import requests
from datetime import datetime

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
API = f"{BASE_URL}/api/v1"

# Couleurs terminal
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"

results = {"pass": 0, "fail": 0, "skip": 0}
token = None
merchant_id = None

# Données de test
TEST_PHONE = f"212{int(time.time()) % 900000000 + 100000000}"
TEST_PASSWORD = "test1234"
product_id = None
supplier_id = None
customer_id = None
listing_id = None


def ok(msg):
    results["pass"] += 1
    print(f"  {GREEN}✓{RESET} {msg}")


def fail(msg, detail=""):
    results["fail"] += 1
    print(f"  {RED}✗{RESET} {msg}")
    if detail:
        print(f"    {RED}→ {detail}{RESET}")


def skip(msg):
    results["skip"] += 1
    print(f"  {YELLOW}○{RESET} {msg} (ignoré)")


def section(title):
    print(f"\n{BOLD}{BLUE}{'='*50}{RESET}")
    print(f"{BOLD}{BLUE}  {title}{RESET}")
    print(f"{BOLD}{BLUE}{'='*50}{RESET}")


def get(path, expected=200):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        r = requests.get(f"{API}{path}", headers=headers, timeout=20)
        return r
    except Exception as e:
        return None


def post(path, data=None, expected=200, auth=True, params=None):
    headers = {"Authorization": f"Bearer {token}"} if (token and auth) else {}
    try:
        r = requests.post(f"{API}{path}", json=data, headers=headers, timeout=15, params=params)
        return r
    except Exception as e:
        return None


def patch(path, data=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        r = requests.patch(f"{API}{path}", json=data, headers=headers, timeout=10)
        return r
    except Exception as e:
        return None


def delete(path):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        r = requests.delete(f"{API}{path}", headers=headers, timeout=10)
        return r
    except Exception as e:
        return None


# ══════════════════════════════════════════
# 1. HEALTH CHECK
# ══════════════════════════════════════════
section("1. HEALTH CHECK")

try:
    r = requests.get(f"{BASE_URL}/health", timeout=5)
    if r.status_code == 200:
        ok(f"Serveur accessible ({BASE_URL})")
    else:
        fail(f"Serveur répond {r.status_code}")
except Exception as e:
    fail(f"Serveur inaccessible", str(e))
    print(f"\n{RED}Le serveur n'est pas accessible. Vérifiez que Docker tourne.{RESET}")
    sys.exit(1)

# ══════════════════════════════════════════
# 2. AUTH - REGISTER & LOGIN
# ══════════════════════════════════════════
section("2. AUTHENTIFICATION")

# Register
r = post("/auth/register", {
    "phone_number": TEST_PHONE,
    "password": TEST_PASSWORD,
    "business_name": "Boutique Test",
    "business_category": "FOOD",
    "city": "Casablanca"
}, auth=False)

if r and r.status_code == 200:
    ok(f"Register → phone={TEST_PHONE}")
    data = r.json()
    token = data.get("access_token")
    merchant_id = data.get("merchant", {}).get("id")
else:
    fail("Register", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")

# Login avec credentials test existants
r2 = post("/auth/login", {
    "phone_number": "212655798315",
    "password": "test1234"
}, auth=False)

if r2 and r2.status_code == 200:
    ok("Login compte test (212655798315)")
    token = r2.json().get("access_token")
    merchant_id = r2.json().get("merchant", {}).get("id")
else:
    fail("Login compte test", f"Status {r2.status_code if r2 else 'timeout'}")

# Me
if token:
    r = get("/auth/me")
    if r and r.status_code == 200:
        me = r.json()
        ok(f"GET /auth/me → {me.get('business_name', '?')}")
    else:
        fail("GET /auth/me", f"Status {r.status_code if r else 'timeout'}")
else:
    skip("GET /auth/me (pas de token)")

# ══════════════════════════════════════════
# 3. MERCHANTS
# ══════════════════════════════════════════
section("3. MERCHANTS")

r = get("/merchants/me")
if r and r.status_code == 200:
    ok("GET /merchants/me")
else:
    fail("GET /merchants/me", f"Status {r.status_code if r else 'timeout'}")

r = patch("/merchants/me", {"city": "Rabat"})
if r and r.status_code == 200:
    ok("PATCH /merchants/me")
else:
    fail("PATCH /merchants/me", f"Status {r.status_code if r else 'timeout'}")

# ══════════════════════════════════════════
# 4. PRODUCTS
# ══════════════════════════════════════════
section("4. PRODUITS")

# Create
r = post("/products/", {
    "name": "Produit Test API",
    "sku": f"TEST-{int(time.time())}",
    "unit_price": 25.50,
    "cost_price": 18.00,
    "unit": "pièce",
    "category": "FOOD"
})
if r and r.status_code == 200:
    product_id = r.json().get("id")
    ok(f"POST /products/ → id={product_id[:8]}...")
else:
    fail("POST /products/", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")

# List
r = get("/products/")
if r and r.status_code == 200:
    count = len(r.json())
    ok(f"GET /products/ → {count} produits")
else:
    fail("GET /products/", f"Status {r.status_code if r else 'timeout'}")

# Get one
if product_id:
    r = get(f"/products/{product_id}")
    if r and r.status_code == 200:
        ok(f"GET /products/{{id}}")
    else:
        fail("GET /products/{id}", f"Status {r.status_code if r else 'timeout'}")

    # Update
    r = patch(f"/products/{product_id}", {"unit_price": 27.00})
    if r and r.status_code == 200:
        ok("PATCH /products/{id}")
    else:
        fail("PATCH /products/{id}", f"Status {r.status_code if r else 'timeout'}")
else:
    skip("GET/PATCH /products/{id} (pas de product_id)")

# ══════════════════════════════════════════
# 5. INVENTORY
# ══════════════════════════════════════════
section("5. INVENTAIRE")

r = get("/inventory/")
if r and r.status_code == 200:
    ok(f"GET /inventory/ → {len(r.json())} articles")
else:
    fail("GET /inventory/", f"Status {r.status_code if r else 'timeout'}")

r = get("/inventory/alerts")
if r and r.status_code == 200:
    ok(f"GET /inventory/alerts → {len(r.json())} alertes")
else:
    fail("GET /inventory/alerts", f"Status {r.status_code if r else 'timeout'}")

if product_id:
    r = post("/inventory/adjust", {
        "product_id": product_id,
        "quantity_change": 50,
        "reason": "Test ajustement"
    })
    if r and r.status_code == 200:
        ok("POST /inventory/adjust (+50 unités)")
    else:
        fail("POST /inventory/adjust", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")
else:
    skip("POST /inventory/adjust (pas de product_id)")

# ══════════════════════════════════════════
# 6. TRANSACTIONS
# ══════════════════════════════════════════
section("6. TRANSACTIONS")

r = get("/transactions/")
if r and r.status_code == 200:
    ok(f"GET /transactions/ → {len(r.json())} transactions")
else:
    fail("GET /transactions/", f"Status {r.status_code if r else 'timeout'}")

if product_id:
    r = post("/transactions/", {
        "type": "SALE",
        "items": [{"product_id": product_id, "quantity": 2, "unit_price": 27.00}],
        "payment_method": "CASH",
        "notes": "Vente test"
    })
    if r and r.status_code == 200:
        ok("POST /transactions/ (vente)")
    else:
        fail("POST /transactions/", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")
else:
    skip("POST /transactions/ (pas de product_id)")

# ══════════════════════════════════════════
# 7. ANALYTICS
# ══════════════════════════════════════════
section("7. ANALYTICS")

r = get("/analytics/dashboard")
if r and r.status_code == 200:
    ok("GET /analytics/dashboard")
else:
    fail("GET /analytics/dashboard", f"Status {r.status_code if r else 'timeout'}")

r = get("/analytics/sales-chart?days=7")
if r and r.status_code == 200:
    ok("GET /analytics/sales-chart?days=7")
else:
    fail("GET /analytics/sales-chart", f"Status {r.status_code if r else 'timeout'}")

r = get("/analytics/profit?days=30")
if r and r.status_code == 200:
    ok("GET /analytics/profit?days=30")
else:
    fail("GET /analytics/profit", f"Status {r.status_code if r else 'timeout'}")

# ══════════════════════════════════════════
# 8. FORECASTS
# ══════════════════════════════════════════
section("8. PRÉVISIONS")

r = get("/forecasts/")
if r and r.status_code == 200:
    ok(f"GET /forecasts/ → {len(r.json())} prévisions")
else:
    fail("GET /forecasts/", f"Status {r.status_code if r else 'timeout'}")

if product_id:
    r = get(f"/forecasts/{product_id}?days=7")
    if r and r.status_code == 200:
        ok("GET /forecasts/{product_id}")
    else:
        fail("GET /forecasts/{product_id}", f"Status {r.status_code if r else 'timeout'}")
else:
    skip("GET /forecasts/{product_id} (pas de product_id)")

# ══════════════════════════════════════════
# 9. SUPPLIERS
# ══════════════════════════════════════════
section("9. FOURNISSEURS")

r = post("/suppliers/", {
    "name": "Fournisseur Test",
    "phone": "0661234567",
    "email": "test@fournisseur.ma",
    "delivery_zone": "Casablanca",
    "payment_terms": "30 jours"
})
if r and r.status_code in (200, 201):
    supplier_id = r.json().get("id")
    ok(f"POST /suppliers/ → id={supplier_id[:8]}...")
else:
    fail("POST /suppliers/", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")

r = get("/suppliers/")
if r and r.status_code == 200:
    ok(f"GET /suppliers/ → {len(r.json())} fournisseurs")
else:
    fail("GET /suppliers/", f"Status {r.status_code if r else 'timeout'}")

if supplier_id:
    r = patch(f"/suppliers/{supplier_id}", {"delivery_zone": "Casablanca + Rabat"})
    if r and r.status_code == 200:
        ok("PATCH /suppliers/{id}")
    else:
        fail("PATCH /suppliers/{id}", f"Status {r.status_code if r else 'timeout'}")

    if product_id:
        r = post(f"/suppliers/{supplier_id}/order", params={"product_id": product_id, "quantity": 100})
        if r and r.status_code == 200:
            ok("POST /suppliers/{id}/order (commande fournisseur)")
        else:
            fail("POST /suppliers/{id}/order", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")

# ══════════════════════════════════════════
# 10. CREDIT
# ══════════════════════════════════════════
section("10. CRÉDIT")

r = get("/credit/score")
if r and r.status_code == 200:
    score = r.json()
    ok(f"GET /credit/score → score={score.get('score', '?')}")
else:
    fail("GET /credit/score", f"Status {r.status_code if r else 'timeout'}")

r = get("/credit/offers")
if r and r.status_code == 200:
    ok(f"GET /credit/offers → {len(r.json())} offres")
else:
    fail("GET /credit/offers", f"Status {r.status_code if r else 'timeout'}")

# ══════════════════════════════════════════
# 11. CUSTOMERS
# ══════════════════════════════════════════
section("11. CLIENTS")

r = post("/customers/", {
    "name": "Ahmed Test",
    "phone": "0612345678",
    "credit_limit": 500.0
})
if r and r.status_code in (200, 201):
    customer_id = r.json().get("id")
    ok(f"POST /customers/ → id={customer_id[:8]}...")
else:
    fail("POST /customers/", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")

r = get("/customers/")
if r and r.status_code == 200:
    ok(f"GET /customers/ → {len(r.json())} clients")
else:
    fail("GET /customers/", f"Status {r.status_code if r else 'timeout'}")

if customer_id:
    r = post(f"/customers/{customer_id}/entries", {
        "amount": 150.0,
        "type": "DEBIT",
        "description": "Achat à crédit"
    })
    if r and r.status_code == 200:
        ok("POST /customers/{id}/entries (crédit)")
    else:
        fail("POST /customers/{id}/entries", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")

# ══════════════════════════════════════════
# 12. MARKETPLACE
# ══════════════════════════════════════════
section("12. MARKETPLACE B2B")

r = get("/marketplace/listings")
if r and r.status_code == 200:
    ok(f"GET /marketplace/listings → {len(r.json())} annonces")
else:
    fail("GET /marketplace/listings", f"Status {r.status_code if r else 'timeout'}")

r = post("/marketplace/listings", {
    "title": "Lot de thé menthe - Test",
    "description": "Lot de 50 boîtes thé menthe qualité premium",
    "category": "FOOD",
    "unit_price": 45.00,
    "min_quantity": 10,
    "available_quantity": 100,
    "unit": "boîte",
    "city": "Casablanca"
})
if r and r.status_code == 200:
    listing_id = r.json().get("id")
    ok(f"POST /marketplace/listings → id={listing_id[:8]}...")
else:
    fail("POST /marketplace/listings", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")

r = get("/marketplace/my-listings")
if r and r.status_code == 200:
    ok(f"GET /marketplace/my-listings → {len(r.json())} mes annonces")
else:
    fail("GET /marketplace/my-listings", f"Status {r.status_code if r else 'timeout'}")

r = get("/marketplace/orders/buying")
if r and r.status_code == 200:
    ok(f"GET /marketplace/orders/buying → {len(r.json())} achats")
else:
    fail("GET /marketplace/orders/buying", f"Status {r.status_code if r else 'timeout'}")

r = get("/marketplace/orders/selling")
if r and r.status_code == 200:
    ok(f"GET /marketplace/orders/selling → {len(r.json())} ventes")
else:
    fail("GET /marketplace/orders/selling", f"Status {r.status_code if r else 'timeout'}")

if listing_id:
    r = patch(f"/marketplace/listings/{listing_id}", {"unit_price": 42.00})
    if r and r.status_code == 200:
        ok("PATCH /marketplace/listings/{id}")
    else:
        fail("PATCH /marketplace/listings/{id}", f"Status {r.status_code if r else 'timeout'}")

# ══════════════════════════════════════════
# 13. PAYMENTS
# ══════════════════════════════════════════
section("13. PAIEMENTS")

r = get("/payments/")
if r and r.status_code == 200:
    ok(f"GET /payments/ → {len(r.json())} paiements")
else:
    fail("GET /payments/", f"Status {r.status_code if r else 'timeout'}")

r = get("/payments/config/me")
if r and r.status_code == 200:
    ok("GET /payments/config/me")
else:
    fail("GET /payments/config/me", f"Status {r.status_code if r else 'timeout'}")

r = post("/payments/", {
    "method": "CASH",
    "amount": 250.00,
    "description": "Paiement test",
    "order_type": "marketplace"
})
if r and r.status_code == 200:
    ok("POST /payments/ (CASH)")
else:
    fail("POST /payments/", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")

# ══════════════════════════════════════════
# 14. MARKET INTELLIGENCE
# ══════════════════════════════════════════
section("14. INTELLIGENCE MARCHÉ")

r = get("/market/overview")
if r and r.status_code == 200:
    ok("GET /market/overview")
else:
    fail("GET /market/overview", f"Status {r.status_code if r else 'timeout'}")

r = get("/market/benchmark")
if r and r.status_code == 200:
    ok("GET /market/benchmark")
else:
    fail("GET /market/benchmark", f"Status {r.status_code if r else 'timeout'}")

r = get("/market/trending-products?limit=10")
if r and r.status_code == 200:
    ok(f"GET /market/trending-products → {len(r.json())} produits")
else:
    fail("GET /market/trending-products", f"Status {r.status_code if r else 'timeout'}")

r = get("/market/price-benchmark")
if r and r.status_code == 200:
    ok(f"GET /market/price-benchmark → {len(r.json())} produits")
else:
    fail("GET /market/price-benchmark", f"Status {r.status_code if r else 'timeout'}")

r = get("/market/trends?weeks=8")
if r and r.status_code == 200:
    ok(f"GET /market/trends → {len(r.json())} semaines")
else:
    fail("GET /market/trends", f"Status {r.status_code if r else 'timeout'}")

# ══════════════════════════════════════════
# 15. NOTIFICATIONS
# ══════════════════════════════════════════
section("15. NOTIFICATIONS")

r = get("/notifications/")
if r and r.status_code == 200:
    ok(f"GET /notifications/ → {len(r.json())} notifications")
else:
    fail("GET /notifications/", f"Status {r.status_code if r else 'timeout'}")

# ══════════════════════════════════════════
# 16. EMPLOYEES
# ══════════════════════════════════════════
section("16. EMPLOYÉS")

r = get("/employees/")
if r and r.status_code == 200:
    ok(f"GET /employees/ → {len(r.json())} employés")
else:
    fail("GET /employees/", f"Status {r.status_code if r else 'timeout'}")

# ══════════════════════════════════════════
# 17. CATALOGUE
# ══════════════════════════════════════════
section("17. CATALOGUE")

if merchant_id:
    r = get(f"/catalogue/{merchant_id}")
    if r and r.status_code == 200:
        data = r.json()
        count = len(data.get("products", data if isinstance(data, list) else []))
        ok(f"GET /catalogue/{{merchant_id}} → {count} produits")
    else:
        fail("GET /catalogue/{merchant_id}", f"Status {r.status_code if r else 'timeout'}")
else:
    skip("GET /catalogue/{merchant_id} (pas de merchant_id)")

# ══════════════════════════════════════════
# 18. EXPORT
# ══════════════════════════════════════════
section("18. EXPORT")

r = get("/export/products")
if r and r.status_code == 200:
    ok(f"GET /export/products → {len(r.content)} bytes CSV")
else:
    fail("GET /export/products", f"Status {r.status_code if r else 'timeout'}")

r = get("/export/transactions?days=30")
if r and r.status_code == 200:
    ok(f"GET /export/transactions → {len(r.content)} bytes CSV")
else:
    fail("GET /export/transactions", f"Status {r.status_code if r else 'timeout'}")

# ══════════════════════════════════════════
# 19. WHATSAPP WEBHOOK
# ══════════════════════════════════════════
section("19. WHATSAPP WEBHOOK")

# Test GET verification
r = requests.get(
    f"{API}/whatsapp/webhook",
    params={
        "hub.mode": "subscribe",
        "hub.verify_token": "souk_ai_verify",
        "hub.challenge": "test_challenge_123"
    },
    timeout=5
)
if r and r.status_code == 200 and "test_challenge_123" in r.text:
    ok("GET /whatsapp/webhook (vérification token)")
else:
    fail("GET /whatsapp/webhook", f"Status {r.status_code if r else 'timeout'}: {r.text[:50] if r else ''}")

# Test POST (message entrant simulé)
payload = {
    "entry": [{
        "changes": [{
            "value": {
                "messages": [{
                    "from": "212600000000",
                    "type": "text",
                    "text": {"body": "bonjour"},
                    "id": "test_msg_001"
                }]
            }
        }]
    }]
}
r = requests.post(f"{API}/whatsapp/webhook", json=payload, timeout=5)
if r and r.status_code == 200:
    ok("POST /whatsapp/webhook (message simulé)")
else:
    fail("POST /whatsapp/webhook", f"Status {r.status_code if r else 'timeout'}: {r.text[:100] if r else ''}")

# ══════════════════════════════════════════
# 20. CLEANUP - Suppression données test
# ══════════════════════════════════════════
section("20. NETTOYAGE")

if listing_id:
    r = delete(f"/marketplace/listings/{listing_id}")
    if r and r.status_code in (200, 204):
        ok(f"DELETE /marketplace/listings (annonce test supprimée)")
    else:
        fail("DELETE /marketplace/listings", f"Status {r.status_code if r else 'timeout'}")

if customer_id:
    r = delete(f"/customers/{customer_id}")
    if r and r.status_code == 200:
        ok(f"DELETE /customers (client test supprimé)")
    else:
        fail("DELETE /customers", f"Status {r.status_code if r else 'timeout'}")

if product_id:
    r = delete(f"/products/{product_id}")
    if r and r.status_code == 200:
        ok(f"DELETE /products (produit test supprimé)")
    else:
        fail("DELETE /products", f"Status {r.status_code if r else 'timeout'}")

# ══════════════════════════════════════════
# RÉSUMÉ FINAL
# ══════════════════════════════════════════
total = results["pass"] + results["fail"] + results["skip"]
print(f"\n{BOLD}{'='*50}{RESET}")
print(f"{BOLD}  RÉSULTATS FINAUX{RESET}")
print(f"{'='*50}")
print(f"  Total:   {total} tests")
print(f"  {GREEN}Réussis: {results['pass']}{RESET}")
print(f"  {RED}Échoués: {results['fail']}{RESET}")
print(f"  {YELLOW}Ignorés: {results['skip']}{RESET}")
pct = int(results["pass"] / max(total - results["skip"], 1) * 100)
print(f"\n  Score: {BOLD}{pct}%{RESET}")
if results["fail"] == 0:
    print(f"\n  {GREEN}{BOLD}✓ Tous les tests passent!{RESET}")
else:
    print(f"\n  {RED}{BOLD}✗ {results['fail']} test(s) échoué(s){RESET}")
print()
