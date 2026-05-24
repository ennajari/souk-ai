from datetime import datetime, timezone
from sqlalchemy import String, Numeric, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class GlobalBarcode(Base):
    __tablename__ = "global_barcodes"

    barcode: Mapped[str] = mapped_column(String(50), primary_key=True)
    name_fr: Mapped[str | None] = mapped_column(String(200), nullable=True)
    name_ar: Mapped[str | None] = mapped_column(String(200), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default="piece")
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    avg_price: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    report_count: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
