import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class TransactionType(str, enum.Enum):
    SALE = "SALE"
    PURCHASE = "PURCHASE"
    ADJUSTMENT = "ADJUSTMENT"
    RETURN = "RETURN"


class TransactionSource(str, enum.Enum):
    WHATSAPP = "WHATSAPP"
    VOICE = "VOICE"
    WEB = "WEB"
    API = "API"


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_transactions_merchant_created", "merchant_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), index=True)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), index=True)
    customer_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("customers.id"), nullable=True, index=True)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    source: Mapped[TransactionSource] = mapped_column(Enum(TransactionSource), default=TransactionSource.WEB)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2))
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    merchant = relationship("Merchant", back_populates="transactions")
    product = relationship("Product", back_populates="transactions")
