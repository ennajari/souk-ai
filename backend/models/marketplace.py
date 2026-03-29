import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Enum, Integer, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class ListingStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    SOLD = "SOLD"
    EXPIRED = "EXPIRED"
    DRAFT = "DRAFT"


class MarketplaceOrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"
    DISPUTED = "DISPUTED"


class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), index=True)
    product_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("products.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="OTHER")
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2))
    min_quantity: Mapped[int] = mapped_column(Integer, default=1)
    available_quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit: Mapped[str] = mapped_column(String(20), default="piece")
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    delivery_zones: Mapped[list | None] = mapped_column(JSON, nullable=True)
    images: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[ListingStatus] = mapped_column(Enum(ListingStatus), default=ListingStatus.ACTIVE)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    views_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    merchant = relationship("Merchant")
    product = relationship("Product")
    orders = relationship("MarketplaceOrder", back_populates="listing", foreign_keys="MarketplaceOrder.listing_id")


class MarketplaceOrder(Base):
    __tablename__ = "marketplace_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    listing_id: Mapped[str] = mapped_column(String(36), ForeignKey("marketplace_listings.id"), index=True)
    buyer_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), index=True)
    seller_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2))
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    status: Mapped[MarketplaceOrderStatus] = mapped_column(Enum(MarketplaceOrderStatus), default=MarketplaceOrderStatus.PENDING)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    listing = relationship("MarketplaceListing", back_populates="orders", foreign_keys=[listing_id])
    buyer = relationship("Merchant", foreign_keys=[buyer_id])
    seller = relationship("Merchant", foreign_keys=[seller_id])
