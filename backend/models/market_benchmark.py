import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class MarketBenchmark(Base):
    __tablename__ = "market_benchmarks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    category: Mapped[str] = mapped_column(String(50), index=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    period: Mapped[str] = mapped_column(String(10))  # YYYY-MM or YYYY-WW
    total_merchants: Mapped[int] = mapped_column(Integer, default=0)
    avg_revenue: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    median_revenue: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    avg_transactions: Mapped[int] = mapped_column(Integer, default=0)
    avg_basket_size: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    top_products: Mapped[list | None] = mapped_column(JSON, nullable=True)
    price_index: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    growth_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
