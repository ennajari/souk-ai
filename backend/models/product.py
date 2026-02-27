import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), index=True)
    name_ar: Mapped[str] = mapped_column(String(100))
    name_fr: Mapped[str] = mapped_column(String(100))
    barcode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default="piece")  # piece, kg, litre, carton
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    cost_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    merchant = relationship("Merchant", back_populates="products")
    inventory = relationship("Inventory", back_populates="product", uselist=False, lazy="selectin")
    transactions = relationship("Transaction", back_populates="product", lazy="selectin")
