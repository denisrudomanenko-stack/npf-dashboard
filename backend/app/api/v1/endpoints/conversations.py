"""
API endpoints for managing chat conversations and history.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
import logging

from app.database import get_db
from app.models.conversation import Conversation, ChatMessage
from app.models.user import User
from app.services.rag_service import rag_service
from app.services.timeweb_ai_service import timeweb_ai_service
from app.schemas.rag import ChatMessage as ChatMessageSchema
from app.auth.dependencies import get_current_active_user

logger = logging.getLogger(__name__)

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
    user_id: Optional[int] = None
    username: Optional[str] = None
    has_rag: bool = False  # True if any message used RAG

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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get conversations. Admin sees all, others see only their own."""
    # Build query based on user role
    query = select(Conversation).where(Conversation.is_archived == False)

    # Filter by user unless admin
    if current_user.role != "admin":
        query = query.where(Conversation.user_id == current_user.id)

    query = query.order_by(desc(Conversation.updated_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    conversations = result.scalars().all()

    response = []
    for conv in conversations:
        # Get message count and check for RAG usage
        msg_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conv.id)
            .order_by(desc(ChatMessage.created_at))
        )
        messages = msg_result.scalars().all()

        last_msg = None
        has_rag = False
        if messages:
            # Get first user message as preview
            user_msgs = [m for m in messages if m.role == "user"]
            if user_msgs:
                last_msg = user_msgs[0].content[:100] + "..." if len(user_msgs[0].content) > 100 else user_msgs[0].content
            # Check if any message used RAG
            has_rag = any(m.use_rag for m in messages)

        # Get username
        username = None
        if conv.user_id:
            user_result = await db.execute(
                select(User).where(User.id == conv.user_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                username = user.username

        response.append(ConversationResponse(
            id=conv.id,
            title=conv.title,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=len(messages),
            last_message=last_msg,
            user_id=conv.user_id,
            username=username,
            has_rag=has_rag
        ))

    return response


@router.post("/", response_model=ConversationResponse)
async def create_conversation(
    data: ConversationCreate = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new conversation."""
    conversation = Conversation(
        title=data.title if data else None,
        user_id=current_user.id
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
        last_message=None,
        user_id=current_user.id,
        username=current_user.username,
        has_rag=False
    )


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a conversation with all its messages."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check access: only owner or admin can view
    if current_user.role != "admin" and conversation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a conversation and all its messages."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check access: only owner or admin can delete
    if current_user.role != "admin" and conversation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Send a message in a conversation and get AI response."""
    # Get conversation
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check access: only owner or admin can chat
    if current_user.role != "admin" and conversation.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

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
        # Generate title using AI
        logger.info(f"Generating title for new conversation {conversation_id}")
        try:
            title = await timeweb_ai_service.generate_chat_title(request.content)
            logger.info(f"Generated title: {title}")
        except Exception as e:
            logger.error(f"Failed to generate title: {e}")
            # Fallback to truncated message
            title = request.content[:27] + "..." if len(request.content) > 30 else request.content
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


@router.post("/regenerate-titles")
async def regenerate_all_titles(
    db: AsyncSession = Depends(get_db)
):
    """Regenerate titles for all conversations using AI."""
    # Get all conversations
    result = await db.execute(
        select(Conversation).where(Conversation.is_archived == False)
    )
    conversations = result.scalars().all()

    updated = 0
    errors = []

    for conv in conversations:
        # Get first user message
        msg_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conv.id)
            .where(ChatMessage.role == "user")
            .order_by(ChatMessage.created_at)
            .limit(1)
        )
        first_message = msg_result.scalar_one_or_none()

        if first_message:
            try:
                logger.info(f"Generating title for conversation {conv.id}: {first_message.content[:50]}...")
                title = await timeweb_ai_service.generate_chat_title(first_message.content)
                conv.title = title
                updated += 1
                logger.info(f"Generated title: {title}")
            except Exception as e:
                logger.error(f"Failed to generate title for conversation {conv.id}: {e}")
                errors.append({"id": conv.id, "error": str(e)})
                # Fallback
                conv.title = first_message.content[:27] + "..." if len(first_message.content) > 30 else first_message.content
                updated += 1

    await db.commit()

    return {
        "message": f"Updated {updated} conversation titles",
        "total": len(conversations),
        "updated": updated,
        "errors": errors
    }
