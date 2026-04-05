import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, Enum, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class SupplierCategory(str, enum.Enum):
    FMCG = "FMCG"
    FRESH = "FRESH"
    BEVERAGES = "BEVERAGES"
    DAIRY = "DAIRY"
    SNACKS = "SNACKS"
    OTHER = "OTHER"


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("merchants.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[SupplierCategory] = mapped_column(Enum(SupplierCategory), default=SupplierCategory.FMCG)
    contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    minimum_order_value: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    product_ids: Mapped[list | None] = mapped_column(JSON, default=list, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    orders = relationship("SupplierOrder", back_populates="supplier")
