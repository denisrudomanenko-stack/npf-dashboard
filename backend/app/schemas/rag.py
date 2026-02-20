from pydantic import BaseModel
from typing import Optional, List
from app.models.document import DocumentType


class RAGQuery(BaseModel):
    query: str
    top_k: int = 5
    document_types: Optional[List[DocumentType]] = None


class RAGSource(BaseModel):
    document_id: int
    document_title: str
    chunk_text: str
    relevance_score: float


class RAGResponse(BaseModel):
    answer: str
    sources: List[RAGSource]


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    use_rag: bool = True
