from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.employee import Employee, EmployeeRole

router = APIRouter(prefix="/employees", tags=["employees"])


# ---------- Schemas ----------

class EmployeeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = None
    pin_code: str = Field(..., min_length=4, max_length=6, pattern=r"^\d{4,6}$")
    role: EmployeeRole = EmployeeRole.CASHIER


class EmployeeUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    pin_code: str | None = Field(None, min_length=4, max_length=6, pattern=r"^\d{4,6}$")
    role: EmployeeRole | None = None


class EmployeeResponse(BaseModel):
    id: str
    merchant_id: str
    name: str
    phone: str | None = None
    role: EmployeeRole
    is_active: bool
    created_at: datetime
    last_login: datetime | None = None

    model_config = {"from_attributes": True}


class PinVerifyRequest(BaseModel):
    pin_code: str = Field(..., min_length=4, max_length=6)


class PinVerifyResponse(BaseModel):
    id: str
    name: str
    role: EmployeeRole

    model_config = {"from_attributes": True}


# ---------- Endpoints ----------

@router.get("/", response_model=list[EmployeeResponse])
async def list_employees(
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Employee)
        .where(Employee.merchant_id == merchant.id, Employee.is_active is True)
        .order_by(Employee.name)
    )
    return result.scalars().all()


@router.post("/", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    data: EmployeeCreate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    # Check duplicate name
    existing = await db.execute(
        select(Employee).where(
            Employee.merchant_id == merchant.id,
            Employee.name == data.name,
            Employee.is_active is True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"L'employe '{data.name}' existe deja")

    employee = Employee(
        merchant_id=merchant.id,
        name=data.name,
        phone=data.phone,
        pin_code=data.pin_code,
        role=data.role,
    )
    db.add(employee)
    await db.flush()
    await db.refresh(employee)
    return employee


@router.patch("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.merchant_id == merchant.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(404, "Employe introuvable")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(employee, key, value)

    await db.flush()
    await db.refresh(employee)
    return employee


@router.delete("/{employee_id}", status_code=204)
async def delete_employee(
    employee_id: str,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.merchant_id == merchant.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(404, "Employe introuvable")

    employee.is_active = False
    await db.flush()


@router.post("/{employee_id}/verify-pin", response_model=PinVerifyResponse)
async def verify_pin(
    employee_id: str,
    data: PinVerifyRequest,
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.merchant_id == merchant.id,
            Employee.is_active is True,
        )
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(404, "Employe introuvable")

    if employee.pin_code != data.pin_code:
        raise HTTPException(401, "Code PIN incorrect")

    # Update last login
    employee.last_login = datetime.now(timezone.utc)
    await db.flush()

    return PinVerifyResponse(id=employee.id, name=employee.name, role=employee.role)
