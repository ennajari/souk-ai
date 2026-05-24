import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Enum, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class EmployeeRole(str, enum.Enum):
    MANAGER = "MANAGER"
    CASHIER = "CASHIER"
    VIEWER = "VIEWER"


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id: Mapped[str] = mapped_column(String(36), ForeignKey("merchants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    pin_code: Mapped[str | None] = mapped_column(String(128), nullable=True)  # Hashed 4-6 digit PIN (optional)
    role: Mapped[EmployeeRole] = mapped_column(Enum(EmployeeRole), default=EmployeeRole.CASHIER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    merchant = relationship("Merchant", backref="employees")
