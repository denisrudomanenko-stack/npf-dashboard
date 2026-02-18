from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse
from typing import List
import json

from app.database import get_db
from app.schemas.rag import RAGQuery, RAGResponse, ChatMessage
from app.services.rag_service import RAGService

router = APIRouter()


@router.post("/query", response_model=RAGResponse)
async def query_rag(query: RAGQuery):
    """Query the RAG system"""
    rag_service = RAGService()
    result = await rag_service.query(
        query=query.query,
        top_k=query.top_k,
        document_types=query.document_types
    )
    return result


@router.post("/chat")
async def chat_with_rag(messages: List[ChatMessage]):
    """Chat with RAG-powered assistant"""
    rag_service = RAGService()
    response = await rag_service.chat(messages)
    return response


@router.post("/chat/stream")
async def chat_stream(messages: List[ChatMessage]):
    """Streaming chat with RAG"""
    rag_service = RAGService()

    async def generate():
        async for chunk in rag_service.chat_stream(messages):
            yield {"event": "message", "data": json.dumps(chunk)}
        yield {"event": "done", "data": ""}

    return EventSourceResponse(generate())


@router.get("/stats")
async def get_rag_stats():
    """Get RAG system statistics"""
    rag_service = RAGService()
    stats = await rag_service.get_stats()
    return stats
