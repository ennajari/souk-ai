from datetime import datetime, timezone, date
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.deps import get_current_merchant
from core.security import hash_password, verify_password
from models.merchant import Merchant
from models.employee import Employee, EmployeeRole
from models.employee_contract import EmployeeContract

router = APIRouter(prefix="/employees", tags=["employees"])

EMPLOYEE_NOT_FOUND = "Employe introuvable"


# ---------- Schemas ----------

class EmployeeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = None
    pin_code: str | None = Field(None, min_length=4, max_length=6, pattern=r"^\d{4,6}$")
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
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Employee)
        .where(Employee.merchant_id == merchant.id, Employee.is_active == True)  # noqa: E712
        .order_by(Employee.name)
    )
    return result.scalars().all()


@router.post("/", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    data: EmployeeCreate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check duplicate name
    existing = await db.execute(
        select(Employee).where(
            Employee.merchant_id == merchant.id,
            Employee.name == data.name,
            Employee.is_active == True,  # noqa: E712
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"L'employe '{data.name}' existe deja")

    employee = Employee(
        merchant_id=merchant.id,
        name=data.name,
        phone=data.phone,
        pin_code=hash_password(data.pin_code) if data.pin_code else None,
        role=data.role,
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    return employee


@router.patch("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.merchant_id == merchant.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(404, EMPLOYEE_NOT_FOUND)

    updates = data.model_dump(exclude_unset=True)
    if "pin_code" in updates:
        updates["pin_code"] = hash_password(updates["pin_code"])
    for key, value in updates.items():
        setattr(employee, key, value)

    await db.commit()
    await db.refresh(employee)
    return employee


@router.delete("/{employee_id}", status_code=204)
async def delete_employee(
    employee_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.merchant_id == merchant.id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(404, EMPLOYEE_NOT_FOUND)

    employee.is_active = False
    await db.commit()


@router.post("/{employee_id}/verify-pin", response_model=PinVerifyResponse)
async def verify_pin(
    employee_id: str,
    data: PinVerifyRequest,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Employee).where(
            Employee.id == employee_id,
            Employee.merchant_id == merchant.id,
            Employee.is_active == True,  # noqa: E712
        )
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(404, EMPLOYEE_NOT_FOUND)

    if not employee.pin_code:
        raise HTTPException(400, "Cet employe n'a pas de code PIN configure")
    if not verify_password(data.pin_code, employee.pin_code):
        raise HTTPException(401, "Code PIN incorrect")

    # Update last login
    employee.last_login = datetime.now(timezone.utc)
    await db.commit()

    return PinVerifyResponse(id=employee.id, name=employee.name, role=employee.role)


# ---------- Contract Schemas ----------

class ContractCreate(BaseModel):
    start_date: date
    end_date: date | None = None
    salary: float = 0
    notes: str | None = None


class ContractUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    salary: float | None = None
    notes: str | None = None
    is_active: bool | None = None


class ContractResponse(BaseModel):
    id: str
    employee_id: str
    merchant_id: str
    start_date: date
    end_date: date | None = None
    salary: float
    notes: str | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Contract Endpoints ----------

@router.get("/{employee_id}/contracts", response_model=list[ContractResponse])
async def list_contracts(
    employee_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all work contracts for an employee."""
    # Verify employee belongs to merchant
    emp = await db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.merchant_id == merchant.id)
    )
    if not emp.scalar_one_or_none():
        raise HTTPException(404, EMPLOYEE_NOT_FOUND)

    result = await db.execute(
        select(EmployeeContract)
        .where(EmployeeContract.employee_id == employee_id, EmployeeContract.merchant_id == merchant.id)
        .order_by(EmployeeContract.start_date.desc())
    )
    return result.scalars().all()


@router.post("/{employee_id}/contracts", response_model=ContractResponse, status_code=201)
async def create_contract(
    employee_id: str,
    data: ContractCreate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Add a work period/contract for an employee."""
    emp = await db.execute(
        select(Employee).where(Employee.id == employee_id, Employee.merchant_id == merchant.id)
    )
    if not emp.scalar_one_or_none():
        raise HTTPException(404, EMPLOYEE_NOT_FOUND)

    if data.end_date and data.end_date < data.start_date:
        raise HTTPException(400, "La date de fin doit etre apres la date de debut")

    contract = EmployeeContract(
        employee_id=employee_id,
        merchant_id=merchant.id,
        start_date=data.start_date,
        end_date=data.end_date,
        salary=data.salary,
        notes=data.notes,
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return contract


@router.patch("/{employee_id}/contracts/{contract_id}", response_model=ContractResponse)
async def update_contract(
    employee_id: str,
    contract_id: str,
    data: ContractUpdate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(EmployeeContract).where(
            EmployeeContract.id == contract_id,
            EmployeeContract.employee_id == employee_id,
            EmployeeContract.merchant_id == merchant.id,
        )
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(404, "Contrat introuvable")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(contract, key, value)

    await db.commit()
    await db.refresh(contract)
    return contract


@router.delete("/{employee_id}/contracts/{contract_id}", status_code=204)
async def delete_contract(
    employee_id: str,
    contract_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(EmployeeContract).where(
            EmployeeContract.id == contract_id,
            EmployeeContract.employee_id == employee_id,
            EmployeeContract.merchant_id == merchant.id,
        )
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(404, "Contrat introuvable")

    contract.is_active = False
    await db.commit()
