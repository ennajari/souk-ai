from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.deps import get_current_merchant
from models.customer import Customer
from models.idempotency import IdempotencyKey
from models.merchant import Merchant
from models.payment import Payment, PaymentMethod, PaymentStatus
from models.product import Product
from models.transaction import Transaction, TransactionType
from schemas.transaction import BulkTransactionCreate, TransactionCreate, TransactionResponse
from services.credit_ledger import apply_entry, lock_customer, notify_credit
from services.sales import SaleError, record_items
from services.soukcard_service import pay_with_soukcard

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _to_response(txn: Transaction, product: Product | None) -> TransactionResponse:
    return TransactionResponse(
        id=txn.id, merchant_id=txn.merchant_id, product_id=txn.product_id,
        customer_id=txn.customer_id,
        product_name_ar=product.name_ar if product else None,
        product_name_fr=product.name_fr if product else None,
        type=txn.type.value, source=txn.source.value,
        quantity=txn.quantity, unit_price=float(txn.unit_price),
        total_amount=float(txn.total_amount), created_at=txn.created_at,
    )


async def _check_customer(db: AsyncSession, merchant_id: str, customer_id: str | None) -> None:
    """Tenant isolation: a sale can only be attached to one of the merchant's own customers (AUDIT S14)."""
    if customer_id and not (await db.execute(
        select(Customer.id).where(Customer.id == customer_id, Customer.merchant_id == merchant_id)
    )).scalar_one_or_none():
        raise HTTPException(404, "Client introuvable")


async def _record_items(
    db: AsyncSession, merchant_id: str, items: list[TransactionCreate], customer_id: str | None,
) -> list[tuple[Transaction, Product]]:
    """services.sales.record_items with business errors mapped to HTTP."""
    try:
        return await record_items(db, merchant_id, items, customer_id)
    except SaleError as e:
        raise HTTPException(e.status, e.message) from None


@router.get("/", response_model=list[TransactionResponse])
async def list_transactions(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    type: str | None = None,
    limit: int = Query(50, le=200),
):
    query = (
        select(Transaction)
        .options(selectinload(Transaction.product))
        .where(Transaction.merchant_id == merchant.id)
    )
    if type:
        query = query.where(Transaction.type == type)
    query = query.order_by(desc(Transaction.created_at)).limit(limit)
    txns = (await db.execute(query)).scalars().all()
    return [_to_response(t, t.product) for t in txns]


@router.post("/", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    req: TransactionCreate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _check_customer(db, merchant.id, req.customer_id)
    [(txn, product)] = await _record_items(db, merchant.id, [req], req.customer_id)
    await db.commit()
    return _to_response(txn, product)


@router.post("/bulk", response_model=list[TransactionResponse], status_code=201)
async def create_transactions_bulk(
    req: BulkTransactionCreate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
    background: BackgroundTasks,
    idempotency_key: Annotated[str | None, Header(max_length=100)] = None,
):
    """POS checkout: sale lines + stock + payment (cash, credit book, Souk card) in ONE DB transaction.

    Before, the browser chained 2-3 requests (invoice → card debit → sale, or sale → credit entry):
    a failure in the middle left a debited card without a sale, or goods out without a debt (AUDIT L2, L3).
    Send an `Idempotency-Key` header: a retried checkout (double tap, offline replay) returns the
    first result instead of selling twice (AUDIT L5).
    """
    if idempotency_key:
        prior = (await db.execute(select(IdempotencyKey).where(
            IdempotencyKey.merchant_id == merchant.id, IdempotencyKey.key == idempotency_key,
        ))).scalar_one_or_none()
        if prior:
            return prior.response
        claim = IdempotencyKey(merchant_id=merchant.id, key=idempotency_key)
        db.add(claim)
        try:
            await db.flush()  # unique (merchant_id, key): a concurrent twin blocks here, then fails
        except IntegrityError:
            raise HTTPException(409, "Cette vente est deja en cours de traitement") from None

    customer_id = req.customer_id
    await _check_customer(db, merchant.id, customer_id)
    lines = await _record_items(db, merchant.id, req.items, customer_id)
    total = sum((t.total_amount for t, _ in lines if t.type == TransactionType.SALE), Decimal("0"))

    credit = None
    if req.payment_method == "CREDIT":
        if not customer_id:
            raise HTTPException(400, "Selectionnez un client pour une vente a credit")
        customer = await lock_customer(db, customer_id, merchant.id)
        label = ", ".join(f"{t.quantity}x {p.name_fr or p.name_ar}" for t, p in lines)
        apply_entry(db, customer, merchant.id, "CREDIT", total, f"POS: {label}")
        credit = (customer.phone, customer.name, total, customer.balance, f"POS: {label}")
    elif req.payment_method == "NFC_SOUKCARD":
        paid = await pay_with_soukcard(
            db, amount=total, merchant_id=merchant.id, reference=f"POS-{lines[0][0].id[:8].upper()}",
            card_number=req.card_number, nfc_uid=req.nfc_uid, pin=req.pin,
        )
        if not paid["success"]:
            raise HTTPException(400, paid["error"])  # rolls back sale lines and stock too
    if req.payment_method in ("NFC_SOUKCARD", "NFC_BANK"):
        db.add(Payment(
            merchant_id=merchant.id, order_id=lines[0][0].id, order_type="pos",
            method=PaymentMethod(req.payment_method), amount=total, currency=merchant.currency or "MAD",
            status=PaymentStatus.COMPLETED, description=f"Vente POS {len(lines)} article(s)",
        ))

    response = [_to_response(t, p).model_dump(mode="json") for t, p in lines]
    if idempotency_key:
        claim.response = response
    await db.commit()

    if credit:
        background.add_task(notify_credit, *credit[:2], merchant.business_name, *credit[2:],
                            merchant.currency or "MAD")
    return response


@router.post("/{transaction_id}/return", response_model=TransactionResponse, status_code=201)
async def return_transaction(
    transaction_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Annuler/retourner une vente — recrédite le stock automatiquement."""
    original = (await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.merchant_id == merchant.id,
            Transaction.type == TransactionType.SALE,
        ).with_for_update().execution_options(populate_existing=True)  # serializes concurrent returns of the same sale
    )).scalar_one_or_none()
    if not original:
        raise HTTPException(404, "Vente introuvable")

    # Returns carry no link to their sale: compare counts of identical sales vs identical returns.
    same = (
        Transaction.merchant_id == merchant.id,
        Transaction.product_id == original.product_id,
        Transaction.quantity == original.quantity,
        Transaction.unit_price == original.unit_price,
    )
    return_count = (await db.execute(select(func.count(Transaction.id)).where(
        *same, Transaction.type == TransactionType.RETURN))).scalar() or 0
    sale_count = (await db.execute(select(func.count(Transaction.id)).where(
        *same, Transaction.type == TransactionType.SALE))).scalar() or 0
    if return_count >= sale_count:
        raise HTTPException(409, "Cette vente a déjà été retournée")

    [(return_txn, product)] = await _record_items(db, merchant.id, [TransactionCreate(
        product_id=original.product_id, customer_id=original.customer_id, type="RETURN",
        source=original.source.value, quantity=original.quantity, unit_price=original.unit_price,
    )], original.customer_id)
    if original.unit_cost is not None:
        return_txn.unit_cost = original.unit_cost  # a return reverses the cost of the sale it cancels
    await db.commit()
    return _to_response(return_txn, product)
