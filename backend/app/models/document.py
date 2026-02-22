from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class DocumentStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class DocumentType(str, enum.Enum):
    REGULATION = "regulation"  # Регламенты
    PRODUCT = "product"  # Описание продуктов
    PRESENTATION = "presentation"  # Презентации
    CONTRACT_TEMPLATE = "contract_template"  # Шаблоны договоров
    ANALYTICS = "analytics"  # Аналитика
    FAQ = "faq"  # FAQ
    METHODOLOGY = "methodology"  # Методика
    INSTRUCTION = "instruction"  # Инструкция
    OTHER = "other"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    file_path = Column(String(500))
    file_type = Column(String(50))  # pdf, docx, xlsx, etc.
    file_size = Column(Integer)

    document_type = Column(SQLEnum(DocumentType), default=DocumentType.OTHER)
    title = Column(String(255))
    description = Column(String(1000))

    content_hash = Column(String(64))  # SHA-256 hash for deduplication
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.ACTIVE)

    indexed_at = Column(DateTime(timezone=True))
    chunk_count = Column(Integer, default=0)  # Number of chunks in vector DB

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Owner (for permission checks)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_id])
