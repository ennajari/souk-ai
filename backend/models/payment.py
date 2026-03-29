import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Enum, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class PaymentMethod(str, enum.Enum):
    CMI = "CMI"
    CASH_PLUS = "CASH_PLUS"
    BANK_TRANSFER = "BANK_TRANSFER"
    CASH = "CASH"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"
    CANCELLED = "CANCELLED"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), index=True)
    order_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    order_type: Mapped[str] = mapped_column(String(20), default="marketplace")  # marketplace, supplier
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(3), default="MAD")
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    external_ref: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gateway_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class MerchantPaymentConfig(Base):
    __tablename__ = "merchant_payment_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), unique=True, index=True)
    cmi_merchant_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cmi_api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cashplus_agent_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cashplus_api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferred_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), default=PaymentMethod.CASH)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
