import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class SupplierOrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class SupplierOrder(Base):
    __tablename__ = "supplier_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("merchants.id"), index=True, nullable=True)
    supplier_id: Mapped[str] = mapped_column(String(36), ForeignKey("suppliers.id"), index=True)
    status: Mapped[SupplierOrderStatus] = mapped_column(Enum(SupplierOrderStatus), default=SupplierOrderStatus.PENDING)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    # Store aggregated items as JSON to avoid complex relational structures for MVP
    # Format: [{"merchant_id": "...", "product_id": "...", "quantity": 10, ...}]
    items: Mapped[list[dict]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    supplier = relationship("Supplier", back_populates="orders")
