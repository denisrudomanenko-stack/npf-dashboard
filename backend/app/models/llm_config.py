from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class LLMConfig(Base):
    """LLM configuration model for persistent storage."""
    __tablename__ = "llm_config"

    id = Column(Integer, primary_key=True, index=True)
    function = Column(String(50), unique=True, nullable=False)  # chat, vision, embeddings
    provider = Column(String(50), nullable=False)  # ollama, anthropic
    model = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
