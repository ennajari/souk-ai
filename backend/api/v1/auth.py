import hmac
import logging
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select, update

from core.database import get_db
from core.security import hash_password, verify_password, create_access_token
from core.deps import get_current_merchant
from models.merchant import Merchant, BusinessCategory, AccountType
from models.supplier import Supplier
from schemas.auth import RegisterRequest, LoginRequest, AdminLoginRequest, TokenResponse
from core.locale import get_country
from core.locale import normalize_phone as _normalize_phone
from core.ratelimit import client_ip, enforce, get_redis, hit
from core.ratelimit import reset as reset_limit

logger = logging.getLogger("souk_ai")
OTP_TTL_S = 600
OTP_MAX_ATTEMPTS = 5

router = APIRouter(prefix="/auth", tags=["auth"])


class ResetRequestBody(BaseModel):
    phone_number: str


class ResetConfirmBody(BaseModel):
    phone_number: str
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)


def normalize_phone(phone: str, country: str | None = "MA") -> str:
    return _normalize_phone(phone, country)


def _token_response(merchant: Merchant, is_admin: bool = False) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(merchant.id, merchant.token_version or 0),
        merchant_id=merchant.id,
        business_name=merchant.business_name,
        is_admin=is_admin,
        account_type=merchant.account_type.value if merchant.account_type else "MERCHANT",
    )


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    await enforce(f"register:{client_ip(request)}", 10, 3600)
    country = get_country(req.country_code)
    phone = normalize_phone(req.phone_number, country.code)
    existing = await db.execute(select(Merchant).where(Merchant.phone_number == phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ce numero de telephone est deja enregistre")

    acct_type = AccountType(req.account_type) if req.account_type in ("MERCHANT", "SUPPLIER") else AccountType.MERCHANT

    merchant = Merchant(
        phone_number=phone,
        hashed_password=hash_password(req.password),
        business_name=req.business_name,
        email=req.email,
        preferred_language=req.preferred_language,
        business_category=BusinessCategory(req.business_category),
        account_type=acct_type,
        country_code=country.code,
        currency=country.currency,
        timezone=country.timezone,
    )
    db.add(merchant)
    await db.commit()

    # Auto-link: if supplier account, link existing Supplier records with same phone
    if acct_type == AccountType.SUPPLIER:
        # Fetch ALL active suppliers and compare normalized phones
        all_suppliers = await db.execute(
            select(Supplier).where(Supplier.phone_number.isnot(None), Supplier.is_active == True)
        )
        linked = 0
        for sup in all_suppliers.scalars().all():
            if normalize_phone(sup.phone_number) == phone:
                sup.supplier_account_id = merchant.id
                linked += 1
        if linked:
            await db.commit()
            logger.info("auto-linked %s supplier records to account %s", linked, merchant.id)

    return _token_response(merchant)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    phone = normalize_phone(req.phone_number)
    # 10 failures / 15 min per account, 50 / 15 min per IP (shared NATs on mobile networks)
    await enforce(f"login:ip:{client_ip(request)}", 50, 900)
    await enforce(f"login:acct:{phone}", 10, 900)
    result = await db.execute(select(Merchant).where(Merchant.phone_number == phone))
    merchant = result.scalar_one_or_none()

    if not merchant or not verify_password(req.password, merchant.hashed_password):
        raise HTTPException(status_code=401, detail="Numero ou mot de passe incorrect")

    await reset_limit(f"login:acct:{phone}")
    return _token_response(merchant)


@router.post("/admin-login", response_model=TokenResponse)
async def admin_login(req: AdminLoginRequest, request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    """Login for Souk.AI startup admin — email-based authentication, DB `is_admin` flag required."""
    await enforce(f"admin-login:{client_ip(request)}", 10, 900)
    # Emails are not unique: only consider the flagged admin account(s)
    result = await db.execute(
        select(Merchant).where(Merchant.email == req.email, Merchant.is_admin == True).limit(1)
    )
    merchant = result.scalar_one_or_none()

    if not merchant or not verify_password(req.password, merchant.hashed_password):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    return _token_response(merchant, is_admin=True)


@router.get("/me")
async def get_me(merchant: Annotated[Merchant, Depends(get_current_merchant)]):
    from schemas.merchant import MerchantResponse
    data = MerchantResponse.model_validate(merchant).model_dump()
    # Don't send is_admin here — frontend uses localStorage value set at login time
    # This ensures phone login never grants admin, only /admin-login does
    data["account_type"] = merchant.account_type.value if merchant.account_type else "MERCHANT"
    return data


@router.post("/reset-request")
async def reset_request(body: ResetRequestBody, request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    """Send a 6-digit OTP to the merchant's WhatsApp number.

    Always answers the same way so the endpoint cannot be used to discover registered numbers.
    """
    phone = normalize_phone(body.phone_number)
    await enforce(f"otp-req:ip:{client_ip(request)}", 10, 3600)
    generic = {"message": "Si ce numero est inscrit, un code a ete envoye par WhatsApp"}
    if not await hit(f"rl:otp-req:acct:{phone}", 3, 3600):  # also caps WhatsApp cost per number
        return generic

    result = await db.execute(select(Merchant).where(Merchant.phone_number == phone))
    if not result.scalar_one_or_none():
        return generic

    code = f"{secrets.randbelow(1_000_000):06d}"
    r = get_redis()
    await r.setex(f"otp:{phone}", OTP_TTL_S, code)
    await r.delete(f"otp-fail:{phone}")

    from services import whatsapp
    try:
        await whatsapp.send_otp_message(phone, code)
    except Exception as e:  # noqa: BLE001
        logger.error("OTP WhatsApp send failed: %s", e)
        raise HTTPException(503, "Impossible d'envoyer le code WhatsApp. Reessayez plus tard ou contactez le support.")

    return generic


@router.post("/reset-confirm", response_model=TokenResponse)
async def reset_confirm(body: ResetConfirmBody, db: Annotated[AsyncSession, Depends(get_db)]):
    """Verify OTP code and set new password."""
    phone = normalize_phone(body.phone_number)

    r = get_redis()
    stored_code = await r.get(f"otp:{phone}")

    if not stored_code:
        raise HTTPException(400, "Aucun code demande ou code expire")
    if not hmac.compare_digest(stored_code, body.code):
        fails = await r.incr(f"otp-fail:{phone}")
        await r.expire(f"otp-fail:{phone}", OTP_TTL_S)
        if fails >= OTP_MAX_ATTEMPTS:
            await r.delete(f"otp:{phone}")  # burn the code: brute force now needs a new OTP
        raise HTTPException(400, "Code incorrect")

    await r.delete(f"otp:{phone}", f"otp-fail:{phone}")

    result = await db.execute(select(Merchant).where(Merchant.phone_number == phone))
    merchant = result.scalar_one_or_none()
    if not merchant:
        raise HTTPException(404, "Compte introuvable")

    merchant.hashed_password = hash_password(body.new_password)
    merchant.token_version = (merchant.token_version or 0) + 1  # log out every other session
    await db.commit()

    return _token_response(merchant)


@router.delete("/account", status_code=204)
async def delete_account(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Permanently delete merchant account and all associated data."""
    from models.product import Product
    from models.transaction import Transaction
    from models.inventory import Inventory, InventoryLog
    from models.conversation import ConversationMessage as Conversation
    from models.customer import Customer, CreditEntry
    from models.notification import Notification
    from models.employee import Employee
    from models.employee_contract import EmployeeContract
    from models.forecast import Forecast
    from models.credit import CreditHistory
    from models.order import Order
    from models.supplier import Supplier
    from models.supplier_order import SupplierOrder
    from models.supplier_catalog import SupplierCatalogItem
    from models.payment import Payment, MerchantPaymentConfig
    from models.marketplace import MarketplaceListing, MarketplaceOrder
    from models.souk_card import CardTransaction
    from models.invoice import Invoice
    from models.credit_request import CreditRequest

    mid = merchant.id

    # Delete credit entries (FK to customers)
    customers_q = await db.execute(select(Customer.id).where(Customer.merchant_id == mid))
    customer_ids = list(customers_q.scalars().all())
    if customer_ids:
        await db.execute(delete(CreditEntry).where(CreditEntry.customer_id.in_(customer_ids)))

    # Delete inventory + logs (FK to products)
    products_q = await db.execute(select(Product.id).where(Product.merchant_id == mid))
    product_ids = list(products_q.scalars().all())
    if product_ids:
        await db.execute(delete(Inventory).where(Inventory.product_id.in_(product_ids)))
    await db.execute(delete(InventoryLog).where(InventoryLog.merchant_id == mid))

    # Delete employee contracts (FK to employees)
    employees_q = await db.execute(select(Employee.id).where(Employee.merchant_id == mid))
    employee_ids = list(employees_q.scalars().all())
    if employee_ids:
        await db.execute(delete(EmployeeContract).where(EmployeeContract.employee_id.in_(employee_ids)))

    # Delete supplier catalog items (FK to suppliers)
    suppliers_q = await db.execute(select(Supplier.id).where(Supplier.merchant_id == mid))
    supplier_ids = list(suppliers_q.scalars().all())
    if supplier_ids:
        await db.execute(delete(SupplierCatalogItem).where(SupplierCatalogItem.supplier_id.in_(supplier_ids)))

    # Delete marketplace orders and listings
    await db.execute(delete(MarketplaceOrder).where(
        (MarketplaceOrder.buyer_id == mid) | (MarketplaceOrder.seller_id == mid)
    ))
    await db.execute(delete(MarketplaceListing).where(MarketplaceListing.merchant_id == mid))

    # Delete payments
    await db.execute(delete(Payment).where(Payment.merchant_id == mid))
    await db.execute(delete(MerchantPaymentConfig).where(MerchantPaymentConfig.merchant_id == mid))

    # Delete all merchant-owned records
    await db.execute(delete(Transaction).where(Transaction.merchant_id == mid))
    await db.execute(delete(SupplierOrder).where(SupplierOrder.merchant_id == mid))
    await db.execute(delete(Supplier).where(Supplier.merchant_id == mid))
    await db.execute(delete(Order).where(Order.merchant_id == mid))
    await db.execute(delete(Product).where(Product.merchant_id == mid))
    await db.execute(delete(Customer).where(Customer.merchant_id == mid))
    await db.execute(delete(Notification).where(Notification.merchant_id == mid))
    await db.execute(delete(Employee).where(Employee.merchant_id == mid))
    await db.execute(delete(Forecast).where(Forecast.merchant_id == mid))
    await db.execute(delete(CreditHistory).where(CreditHistory.merchant_id == mid))
    await db.execute(delete(Conversation).where(Conversation.merchant_id == mid))

    # Card ledgers belong to card holders: keep them (balances must stay auditable) but detach this merchant
    await db.execute(update(CardTransaction).where(CardTransaction.merchant_id == mid).values(merchant_id=None))
    await db.execute(update(Supplier).where(Supplier.supplier_account_id == mid).values(supplier_account_id=None))
    await db.execute(delete(Invoice).where(Invoice.merchant_id == mid))
    await db.execute(delete(CreditRequest).where(CreditRequest.merchant_id == mid))

    # Delete merchant
    await db.execute(delete(Merchant).where(Merchant.id == mid))
    await db.commit()
