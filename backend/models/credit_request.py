import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Numeric, DateTime, Enum, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class CreditRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DISBURSED = "DISBURSED"


class CreditRequest(Base):
    __tablename__ = "credit_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    term_days: Mapped[int] = mapped_column(Integer)
    fee_percentage: Mapped[float] = mapped_column(Numeric(5, 2))
    status: Mapped[CreditRequestStatus] = mapped_column(
        Enum(CreditRequestStatus), default=CreditRequestStatus.PENDING, server_default="PENDING"
    )
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
