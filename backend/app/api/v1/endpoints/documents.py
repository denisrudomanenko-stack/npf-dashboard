from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import hashlib
import os
from datetime import datetime

from app.database import get_db
from app.models.document import Document, DocumentStatus, DocumentType
from app.schemas.document import DocumentResponse
from app.services.rag_service import RAGService

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


@router.get("/", response_model=List[DocumentResponse])
async def get_documents(
    skip: int = 0,
    limit: int = 100,
    status: DocumentStatus = None,
    document_type: DocumentType = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Document).where(Document.status != DocumentStatus.DELETED)
    if status:
        query = query.where(Document.status == status)
    if document_type:
        query = query.where(Document.document_type == document_type)
    query = query.order_by(Document.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: DocumentType = DocumentType.OTHER,
    title: str = None,
    description: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Upload and index a document for RAG"""
    allowed_extensions = {'.pdf', '.docx', '.txt', '.xlsx', '.xls', '.csv'}
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type {file_ext} not allowed")

    contents = await file.read()
    content_hash = get_file_hash(contents)

    # Check for duplicates
    result = await db.execute(
        select(Document).where(Document.content_hash == content_hash)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Document already exists")

    # Save file
    filename = f"{content_hash[:16]}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as f:
        f.write(contents)

    # Create DB record
    doc = Document(
        filename=filename,
        original_filename=file.filename,
        file_path=file_path,
        file_type=file_ext[1:],
        file_size=len(contents),
        document_type=document_type,
        title=title or file.filename,
        description=description,
        content_hash=content_hash,
        status=DocumentStatus.ACTIVE
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Index in RAG
    rag_service = RAGService()
    chunk_count = await rag_service.index_document(doc.id, file_path, file_ext[1:])

    doc.indexed_at = datetime.utcnow()
    doc.chunk_count = chunk_count
    await db.commit()

    return {"message": "Document uploaded and indexed", "document_id": doc.id, "chunks": chunk_count}


@router.post("/{document_id}/reindex")
async def reindex_document(document_id: int, db: AsyncSession = Depends(get_db)):
    """Re-index a document in vector DB"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    rag_service = RAGService()
    await rag_service.delete_document_chunks(document_id)
    chunk_count = await rag_service.index_document(doc.id, doc.file_path, doc.file_type)

    doc.indexed_at = datetime.utcnow()
    doc.chunk_count = chunk_count
    await db.commit()

    return {"message": "Document reindexed", "chunks": chunk_count}


@router.patch("/{document_id}/archive")
async def archive_document(document_id: int, db: AsyncSession = Depends(get_db)):
    """Archive document and remove from search"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.status = DocumentStatus.ARCHIVED
    await db.commit()

    return {"message": "Document archived"}


@router.delete("/{document_id}")
async def delete_document(document_id: int, db: AsyncSession = Depends(get_db)):
    """Soft delete document"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove from vector DB
    rag_service = RAGService()
    await rag_service.delete_document_chunks(document_id)

    doc.status = DocumentStatus.DELETED
    await db.commit()

    return {"message": "Document deleted"}
