import uuid
from datetime import datetime, date, timezone
from sqlalchemy import String, Numeric, DateTime, ForeignKey, Integer, Date, JSON
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Forecast(Base):
    __tablename__ = "forecasts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), index=True)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), index=True)
    forecast_date: Mapped[date] = mapped_column(Date, index=True)
    predicted_demand: Mapped[float] = mapped_column(Numeric(10, 2))
    confidence_lower: Mapped[float] = mapped_column(Numeric(10, 2))
    confidence_upper: Mapped[float] = mapped_column(Numeric(10, 2))
    restock_recommendation: Mapped[int] = mapped_column(Integer, default=0)
    factors: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
