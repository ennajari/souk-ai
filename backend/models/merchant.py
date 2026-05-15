import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Enum, DateTime, Boolean, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class BusinessCategory(str, enum.Enum):
    GROCERY = "GROCERY"
    BAKERY = "BAKERY"
    BUTCHER = "BUTCHER"
    PHARMACY = "PHARMACY"
    RESTAURANT = "RESTAURANT"
    MARKET = "MARKET"
    OTHER = "OTHER"


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phone_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(128))
    business_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(5), default="AR")
    business_category: Mapped[BusinessCategory] = mapped_column(
        Enum(BusinessCategory), default=BusinessCategory.GROCERY
    )
    owner_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location_lat: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    credit_score: Mapped[int] = mapped_column(Integer, default=500)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    products = relationship("Product", back_populates="merchant", lazy="select")
    transactions = relationship("Transaction", back_populates="merchant", lazy="select")
