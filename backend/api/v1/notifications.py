from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, update
from pydantic import BaseModel

from core.database import get_db
from core.deps import get_current_merchant
from models.merchant import Merchant
from models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationCreate(BaseModel):
    type: str = "system"
    title: str
    message: str | None = None


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str | None = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Notification)
        .where(Notification.merchant_id == merchant.id)
        .order_by(desc(Notification.created_at))
        .limit(50)
    )
    return result.scalars().all()


@router.post("/", response_model=NotificationResponse, status_code=201)
async def create_notification(
    data: NotificationCreate,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    notif = Notification(
        merchant_id=merchant.id,
        type=data.type,
        title=data.title,
        message=data.message,
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    return notif


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.merchant_id == merchant.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(404, "Notification not found")
    notif.is_read = True
    await db.commit()
    return {"status": "ok"}


@router.patch("/read-all")
async def mark_all_read(
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await db.execute(
        update(Notification)
        .where(Notification.merchant_id == merchant.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    merchant: Annotated[Merchant, Depends(get_current_merchant)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.merchant_id == merchant.id,
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(404, "Notification not found")
    await db.delete(notif)
    await db.commit()
    return {"status": "ok"}
