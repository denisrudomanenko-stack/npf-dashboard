"""
API endpoints for managing chat conversations and history.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from app.database import get_db
from app.models.conversation import Conversation, ChatMessage
from app.services.rag_service import rag_service
from app.schemas.rag import ChatMessage as ChatMessageSchema

router = APIRouter()


# Pydantic schemas
class MessageCreate(BaseModel):
    role: str
    content: str
    use_rag: bool = True


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    use_rag: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    title: Optional[str] = None


class ConversationResponse(BaseModel):
    id: int
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message: Optional[str] = None

    class Config:
        from_attributes = True


class ConversationDetailResponse(BaseModel):
    id: int
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse]

    class Config:
        from_attributes = True


class ChatInConversationRequest(BaseModel):
    content: str
    use_rag: bool = True


@router.get("/", response_model=List[ConversationResponse])
async def list_conversations(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get all conversations, ordered by most recent."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.is_archived == False)
        .order_by(desc(Conversation.updated_at))
        .offset(skip)
        .limit(limit)
    )
    conversations = result.scalars().all()

    response = []
    for conv in conversations:
        # Get message count and last message
        msg_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conv.id)
            .order_by(desc(ChatMessage.created_at))
        )
        messages = msg_result.scalars().all()

        last_msg = None
        if messages:
            # Get first user message as preview
            user_msgs = [m for m in messages if m.role == "user"]
            if user_msgs:
                last_msg = user_msgs[0].content[:100] + "..." if len(user_msgs[0].content) > 100 else user_msgs[0].content

        response.append(ConversationResponse(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=len(messages),
            last_message=last_msg
        ))

    return response


@router.post("/", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate = None,
    db: AsyncSession = Depends(get_db)
):
    """Create a new conversation."""
    conversation = Conversation(
        title=data.title if data else None
    )
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)

    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        message_count=0,
        last_message=None
    )


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a conversation with all its messages."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get messages
    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at)
    )
    messages = msg_result.scalars().all()

    return ConversationDetailResponse(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=[MessageResponse(
            id=m.id,
            role=m.role,
            content=m.content,
            use_rag=m.use_rag,
            created_at=m.created_at
        ) for m in messages]
    )


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a conversation and all its messages."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conversation)
    await db.commit()

    return {"message": "Conversation deleted", "id": conversation_id}


@router.patch("/{conversation_id}/title")
async def update_conversation_title(
    conversation_id: int,
    title: str,
    db: AsyncSession = Depends(get_db)
):
    """Update conversation title."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation.title = title
    await db.commit()

    return {"message": "Title updated", "title": title}


@router.post("/{conversation_id}/chat")
async def chat_in_conversation(
    conversation_id: int,
    request: ChatInConversationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send a message in a conversation and get AI response."""
    # Get conversation
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    user_message = ChatMessage(
        conversation_id=conversation_id,
        role="user",
        content=request.content,
        use_rag=request.use_rag
    )
    db.add(user_message)

    # Get conversation history for context
    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at)
    )
    history = msg_result.scalars().all()

    # Build messages list for RAG service
    messages = [
        ChatMessageSchema(role=m.role, content=m.content)
        for m in history
    ]
    messages.append(ChatMessageSchema(role="user", content=request.content))

    # Get AI response
    try:
        response = await rag_service.chat(messages, use_rag=request.use_rag)
        assistant_content = response.get("content", "Произошла ошибка при генерации ответа.")
    except Exception as e:
        assistant_content = f"Ошибка: {str(e)}"

    # Save assistant message
    assistant_message = ChatMessage(
        conversation_id=conversation_id,
        role="assistant",
        content=assistant_content,
        use_rag=request.use_rag
    )
    db.add(assistant_message)

    # Update conversation title if it's the first message
    if not conversation.title and len(history) == 0:
        # Generate title from first user message
        title = request.content[:50]
        if len(request.content) > 50:
            title += "..."
        conversation.title = title

    # Update conversation timestamp
    conversation.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(user_message)
    await db.refresh(assistant_message)

    return {
        "user_message": MessageResponse(
            id=user_message.id,
            role=user_message.role,
            content=user_message.content,
            use_rag=user_message.use_rag,
            created_at=user_message.created_at
        ),
        "assistant_message": MessageResponse(
            id=assistant_message.id,
            role=assistant_message.role,
            content=assistant_message.content,
            use_rag=assistant_message.use_rag,
            created_at=assistant_message.created_at
        )
    }


@router.delete("/{conversation_id}/messages")
async def clear_conversation_messages(
    conversation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Clear all messages in a conversation but keep the conversation."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Delete all messages
    await db.execute(
        ChatMessage.__table__.delete().where(ChatMessage.conversation_id == conversation_id)
    )
    conversation.title = None
    await db.commit()

    return {"message": "Messages cleared", "conversation_id": conversation_id}
