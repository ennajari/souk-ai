import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, Enum, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class CardType(str, enum.Enum):
    CLIENT = "CLIENT"
    SUPPLIER = "SUPPLIER"


class CardStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SUSPENDED = "SUSPENDED"
    EXPIRED = "EXPIRED"


class CardTransactionType(str, enum.Enum):
    TOP_UP = "TOP_UP"
    PAYMENT = "PAYMENT"
    REFUND = "REFUND"


class SoukCard(Base):
    __tablename__ = "souk_cards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    card_number: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    holder_name: Mapped[str] = mapped_column(String(100))
    holder_phone: Mapped[str] = mapped_column(String(20), index=True)
    pin_hash: Mapped[str] = mapped_column(String(128))
    balance: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    card_type: Mapped[CardType] = mapped_column(Enum(CardType), default=CardType.CLIENT, server_default="CLIENT")
    status: Mapped[CardStatus] = mapped_column(Enum(CardStatus), default=CardStatus.ACTIVE)
    nfc_uid: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    transactions = relationship("CardTransaction", back_populates="card", lazy="selectin", order_by="CardTransaction.created_at.desc()")


class CardTransaction(Base):
    __tablename__ = "card_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    card_id: Mapped[str] = mapped_column(String(36), ForeignKey("souk_cards.id"), index=True)
    type: Mapped[CardTransactionType] = mapped_column(Enum(CardTransactionType))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    balance_after: Mapped[float] = mapped_column(Numeric(10, 2))
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    merchant_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("merchants.id"), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    card = relationship("SoukCard", back_populates="transactions")
