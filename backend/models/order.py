import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Enum, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), index=True)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.PENDING)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
