from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.conversation import ConversationMessage, MessageRole, MessageType

CONVERSATION_TIMEOUT_MINUTES = 30
MAX_CONTEXT_MESSAGES = 10


async def get_conversation_history(db: AsyncSession, merchant_id: str) -> list[dict]:
    """Load last N messages within the timeout window."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=CONVERSATION_TIMEOUT_MINUTES)
    result = await db.execute(
        select(ConversationMessage)
        .where(
            ConversationMessage.merchant_id == merchant_id,
            ConversationMessage.created_at >= cutoff,
        )
        .order_by(ConversationMessage.created_at.desc())
        .limit(MAX_CONTEXT_MESSAGES)
    )
    messages = result.scalars().all()
    return [
        {"role": "user" if m.role == MessageRole.USER else "assistant", "content": m.content}
        for m in reversed(messages)
    ]


async def save_message(
    db: AsyncSession,
    merchant_id: str,
    role: MessageRole,
    content: str,
    message_type: MessageType = MessageType.TEXT,
    intent: str | None = None,
) -> ConversationMessage:
    msg = ConversationMessage(
        merchant_id=merchant_id,
        role=role,
        content=content,
        message_type=message_type,
        intent=intent,
    )
    db.add(msg)
    await db.flush()
    return msg
