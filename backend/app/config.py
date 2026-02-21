from pydantic_settings import BaseSettings
from typing import Optional
import os
import secrets


class Settings(BaseSettings):
    # App
    app_name: str = "NPF Development"
    debug: bool = True

    # Database
    database_url: str = "sqlite+aiosqlite:///./npf.db"

    # JWT Authentication (reads from SECRET_KEY env var or generates random)
    secret_key: str = secrets.token_urlsafe(32)
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24  # 24 hours

    @property
    def jwt_secret_key(self) -> str:
        """JWT secret key - uses SECRET_KEY from env."""
        return self.secret_key

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    ollama_embed_model: str = "nomic-embed-text"

    # Anthropic (fallback for OCR and complex tasks)
    anthropic_api_key: Optional[str] = None
    anthropic_chat_model: str = "claude-sonnet-4-20250514"

    # LLM Provider settings (runtime configurable)
    chat_provider: str = "ollama"  # ollama or anthropic
    vision_model: str = "claude-sonnet-4-20250514"

    # ChromaDB
    chroma_persist_directory: str = "./data/chromadb"

    # Documents
    documents_directory: str = "./data/documents"
    converted_directory: str = "./data/converted"
    max_upload_size_mb: int = 50

    # RAG
    default_top_k: int = 5
    max_context_tokens: int = 2000

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure directories exist
os.makedirs(settings.chroma_persist_directory, exist_ok=True)
os.makedirs(settings.documents_directory, exist_ok=True)
os.makedirs(settings.converted_directory, exist_ok=True)
