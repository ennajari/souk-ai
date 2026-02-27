import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class TransactionType(str, enum.Enum):
    SALE = "SALE"
    PURCHASE = "PURCHASE"
    ADJUSTMENT = "ADJUSTMENT"


class TransactionSource(str, enum.Enum):
    WHATSAPP = "WHATSAPP"
    WEB = "WEB"
    API = "API"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), index=True)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), index=True)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    source: Mapped[TransactionSource] = mapped_column(Enum(TransactionSource), default=TransactionSource.WEB)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2))
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    merchant = relationship("Merchant", back_populates="transactions")
    product = relationship("Product", back_populates="transactions")
