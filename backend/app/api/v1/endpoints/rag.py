from fastapi import APIRouter, HTTPException, Form, Depends
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
import json

from app.schemas.rag import RAGQuery, RAGResponse, ChatMessage, ChatRequest
from app.services.rag_service import rag_service
from app.services.document_service import document_service
from app.database import get_db
from app.models.llm_config import LLMConfig
from app.config import settings

router = APIRouter()

# Default LLM configurations
DEFAULT_LLM_CONFIGS = {
    "chat": {"provider": "ollama", "model": "qwen2.5:7b"},
    "vision": {"provider": "anthropic", "model": "claude-sonnet-4-20250514"},
    "embeddings": {"provider": "ollama", "model": "nomic-embed-text"}
}


@router.post("/query", response_model=RAGResponse)
async def query_rag(query: RAGQuery):
    """Query the RAG system with a question."""
    if not query.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    result = await rag_service.query(
        query=query.query,
        top_k=query.top_k,
        doc_types=query.document_types
    )
    return result


@router.post("/search")
async def search_knowledge_base(
    query: str = Form(...),
    top_k: int = Form(default=5),
    doc_type: Optional[str] = Form(default=None),
    min_score: float = Form(default=0.0)
):
    """Search the knowledge base without generating an answer."""
    results = await document_service.search(
        query=query,
        top_k=top_k,
        doc_type=doc_type,
        min_score=min_score
    )
    return {"query": query, "results": results}


@router.post("/chat")
async def chat_with_rag(request: ChatRequest):
    """Chat with optional RAG-powered assistant."""
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    response = await rag_service.chat(request.messages, use_rag=request.use_rag)
    return response


@router.post("/chat/stream")
async def chat_stream(messages: List[ChatMessage]):
    """Streaming chat with RAG."""
    if not messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    async def generate():
        async for chunk in rag_service.chat_stream(messages):
            yield {"event": "message", "data": json.dumps(chunk, ensure_ascii=False)}
        yield {"event": "done", "data": ""}

    return EventSourceResponse(generate())


@router.get("/context")
async def get_context(
    query: str,
    max_tokens: int = 2000
):
    """Get relevant context from knowledge base for a query."""
    context = await document_service.get_context_for_query(query, max_tokens=max_tokens)
    return {"query": query, "context": context, "has_context": bool(context)}


@router.get("/stats")
async def get_rag_stats():
    """Get RAG system statistics."""
    stats = await rag_service.get_stats()
    return stats


@router.get("/ai-status")
async def get_ai_status():
    """Get AI services availability status."""
    from app.services.ollama_service import ollama_service

    ollama_available = await ollama_service.is_available()
    anthropic_configured = bool(settings.anthropic_api_key)

    return {
        "ai_available": ollama_available or anthropic_configured,
        "can_vectorize": ollama_available,  # Requires embeddings from Ollama
        "can_suggest_name": ollama_available or anthropic_configured,
        "can_ocr": anthropic_configured  # Requires Claude Vision
    }


@router.post("/test-embedding")
async def test_embedding(text: str = Form(...)):
    """Test embedding generation (for debugging)."""
    from app.services.ollama_service import ollama_service

    is_available = await ollama_service.is_available()
    if not is_available:
        return {
            "ollama_available": False,
            "message": "Ollama not available. Using ChromaDB built-in embeddings."
        }

    embedding = await ollama_service.embed(text[:500])
    return {
        "ollama_available": True,
        "text_length": len(text),
        "embedding_dimension": len(embedding),
        "embedding_preview": embedding[:5]  # First 5 values
    }


@router.get("/llm-config")
async def get_llm_config(db: AsyncSession = Depends(get_db)):
    """Get LLM configuration for all model categories (persistent)."""
    from app.services.ollama_service import ollama_service
    from app.config import settings
    import httpx

    # Get available Ollama models
    available_ollama_models = []
    ollama_available = False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{ollama_service.base_url}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                ollama_available = True
                available_ollama_models = [m.get("name", "") for m in models]
    except Exception:
        pass

    # Check Anthropic API key
    anthropic_configured = bool(settings.anthropic_api_key)

    # Load configs from database
    result = await db.execute(select(LLMConfig).where(LLMConfig.is_active == True))
    db_configs = {c.function: {"provider": c.provider, "model": c.model} for c in result.scalars().all()}

    # Merge with defaults
    chat_config = db_configs.get("chat", DEFAULT_LLM_CONFIGS["chat"])
    vision_config = db_configs.get("vision", DEFAULT_LLM_CONFIGS["vision"])
    embeddings_config = db_configs.get("embeddings", DEFAULT_LLM_CONFIGS["embeddings"])

    return {
        "ollama_available": ollama_available,
        "anthropic_configured": anthropic_configured,
        "chat": chat_config,
        "vision": vision_config,
        "embeddings": embeddings_config,
        "available_ollama_models": available_ollama_models,
        "anthropic_models": [
            "claude-sonnet-4-20250514",
            "claude-opus-4-20250514",
            "claude-3-5-sonnet-20241022",
            "claude-3-haiku-20240307"
        ]
    }


@router.post("/llm-config")
async def update_llm_config(
    category: str = Form(...),
    provider: str = Form(...),
    model: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Update LLM configuration for a category (persistent)."""
    from app.services.ollama_service import ollama_service

    if category not in ["chat", "vision", "embeddings"]:
        raise HTTPException(status_code=400, detail="Invalid category. Use: chat, vision, embeddings")

    # Check if config exists
    result = await db.execute(select(LLMConfig).where(LLMConfig.function == category))
    config = result.scalar_one_or_none()

    if config:
        # Update existing
        config.provider = provider
        config.model = model
    else:
        # Create new
        config = LLMConfig(function=category, provider=provider, model=model, is_active=True)
        db.add(config)

    await db.commit()

    # Also update runtime services for immediate effect
    if category == "chat" and provider == "ollama":
        ollama_service.model = model
    elif category == "embeddings" and provider == "ollama":
        ollama_service.embed_model = model

    return {"message": f"Configuration saved for {category}", "provider": provider, "model": model}


@router.post("/llm-config/reset")
async def reset_llm_config(
    category: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """Reset LLM configuration to defaults (deletes from DB)."""
    from app.services.ollama_service import ollama_service

    if category not in ["chat", "vision", "embeddings"]:
        raise HTTPException(status_code=400, detail="Invalid category. Use: chat, vision, embeddings")

    # Delete from database
    await db.execute(delete(LLMConfig).where(LLMConfig.function == category))
    await db.commit()

    # Reset runtime services to defaults
    default = DEFAULT_LLM_CONFIGS[category]
    if category == "chat" and default["provider"] == "ollama":
        ollama_service.model = default["model"]
    elif category == "embeddings" and default["provider"] == "ollama":
        ollama_service.embed_model = default["model"]

    return {"message": f"Configuration reset for {category}", **default}
