import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class IdempotencyKey(Base):
    """Stores the response of a write request so a retried request returns it instead of re-executing."""
    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("merchant_id", "key", name="uq_idempotency_merchant_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(100))
    response: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
