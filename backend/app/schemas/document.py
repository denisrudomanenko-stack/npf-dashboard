from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.document import DocumentStatus, DocumentType


class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_filename: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    document_type: Optional[DocumentType] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: DocumentStatus
    indexed_at: Optional[datetime] = None
    chunk_count: Optional[int] = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
