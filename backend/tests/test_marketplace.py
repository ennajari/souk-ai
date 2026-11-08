"""Marketplace order state machine (logic pass 2)."""
import asyncio

from tests.conftest import register

M = "/api/v1/marketplace"


async def _listing(client, h, qty=10):
    r = await client.post(f"{M}/listings", json={"title": "Huile 5L x 10", "unit_price": 80, "min_quantity": 1,
                                                  "available_quantity": qty, "category": "FMCG", "unit": "carton",
                                                  "city": "Casablanca"}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()["id"]


async def _status(client, h, oid, st):
    return (await client.patch(f"{M}/orders/{oid}/status", json={"status": st}, headers=h)).status_code


async def _available(client, h, lid):
    mine = (await client.get(f"{M}/my-listings", headers=h)).json()
    return next(x for x in mine if x["id"] == lid)["available_quantity"]


async def test_order_lifecycle_and_no_double_restock(client):
    seller = await register(client, phone="0612000001")
    buyer = await register(client, phone="0612000002")
    lid = await _listing(client, seller, qty=10)
    oid = (await client.post(f"{M}/orders", json={"listing_id": lid, "quantity": 4}, headers=buyer)).json()["id"]
    assert await _available(client, seller, lid) == 6

    assert await _status(client, buyer, oid, "DELIVERED") == 409   # not shipped yet
    assert await _status(client, seller, oid, "ACCEPTED") == 200
    assert await _status(client, seller, oid, "SHIPPED") == 200
    assert await _status(client, seller, oid, "CANCELLED") == 409  # too late for the seller
    assert await _status(client, buyer, oid, "DELIVERED") == 200
    assert await _status(client, buyer, oid, "CANCELLED") == 409   # terminal
    assert await _available(client, seller, lid) == 6


async def test_cancel_restocks_exactly_once(client):
    seller = await register(client, phone="0612000003")
    buyer = await register(client, phone="0612000004")
    lid = await _listing(client, seller, qty=10)
    oid = (await client.post(f"{M}/orders", json={"listing_id": lid, "quantity": 4}, headers=buyer)).json()["id"]
    assert await _status(client, buyer, oid, "CANCELLED") == 200
    assert await _status(client, buyer, oid, "CANCELLED") == 409
    assert await _status(client, seller, oid, "ACCEPTED") == 409   # can't revive a cancelled order
    assert await _available(client, seller, lid) == 10


async def test_concurrent_buyers_cannot_oversell(client):
    seller = await register(client, phone="0612000005")
    buyers = [await register(client, phone=f"061200001{i}") for i in range(4)]
    lid = await _listing(client, seller, qty=5)
    res = await asyncio.gather(*[client.post(f"{M}/orders", json={"listing_id": lid, "quantity": 3}, headers=b)
                                 for b in buyers])
    assert sorted(r.status_code for r in res).count(200) == 1
    assert await _available(client, seller, lid) == 2


async def test_outsider_cannot_touch_order(client):
    seller = await register(client, phone="0612000006")
    buyer = await register(client, phone="0612000007")
    other = await register(client, phone="0612000008")
    lid = await _listing(client, seller)
    oid = (await client.post(f"{M}/orders", json={"listing_id": lid, "quantity": 1}, headers=buyer)).json()["id"]
    assert await _status(client, other, oid, "CANCELLED") == 404
