import os
import re
import json
import hashlib
from typing import List, Optional, Dict, Any
from datetime import datetime
from pathlib import Path
import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings
from app.services.ollama_service import ollama_service

import logging
logger = logging.getLogger(__name__)


# Chunk sizes by document type (НПФ-специфичные типы)
CHUNK_CONFIG = {
    # НПФ документы
    "regulation": {"size": 800, "overlap": 80},       # Регламенты НПФ
    "product": {"size": 1000, "overlap": 100},        # Описание продуктов (ПДС, КПП)
    "presentation": {"size": 400, "overlap": 40},     # Презентации
    "contract_template": {"size": 600, "overlap": 60}, # Шаблоны договоров
    "analytics": {"size": 1000, "overlap": 100},      # Аналитические отчёты
    "faq": {"size": 500, "overlap": 50},              # FAQ, частые вопросы

    # Общие типы
    "methodology": {"size": 1000, "overlap": 100},    # Методики
    "instruction": {"size": 600, "overlap": 60},      # Инструкции
    "article": {"size": 1000, "overlap": 100},        # Статьи
    "meeting": {"size": 500, "overlap": 50},          # Протоколы встреч
    "textbook": {"size": 1200, "overlap": 120},       # Учебники
    "other": {"size": 600, "overlap": 60},            # Иное
}

# Document status flow
DOCUMENT_STATUSES = {
    "uploaded": "Загружен",
    "processing": "Обработка",
    "indexed": "Проиндексирован",
    "error": "Ошибка",
    "archived": "Архив"
}


class DocumentService:
    """Service for managing NPF knowledge base documents with RAG."""

    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_directory,
            settings=ChromaSettings(anonymized_telemetry=False)
        )
        self.collection = self.client.get_or_create_collection(
            name="npf_knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )
        self.docs_dir = Path(settings.documents_directory)
        self.docs_dir.mkdir(parents=True, exist_ok=True)

    def _get_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash of content."""
        return hashlib.sha256(content.encode()).hexdigest()

    def _split_text(self, text: str, chunk_size: int = 600, chunk_overlap: int = 60) -> List[str]:
        """Split text into overlapping chunks for better retrieval."""
        # Clean text - normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        if not text or len(text) < 10:
            return []

        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size

            # Try to end at sentence boundary
            if end < len(text):
                # Look for sentence end near chunk boundary
                best_end = end
                for sep in ['. ', '! ', '? ', '\n', '; ']:
                    last_sep = text[start:end].rfind(sep)
                    if last_sep > chunk_size * 0.5:
                        best_end = start + last_sep + len(sep)
                        break
                end = best_end

            chunk = text[start:end].strip()
            if chunk and len(chunk) >= 10:  # Skip very short chunks
                chunks.append(chunk)

            start = end - chunk_overlap
            if start >= len(text) - chunk_overlap:
                break

        return chunks

    async def extract_text(self, file_path: str, file_type: str) -> str:
        """Extract text from various file formats."""
        file_path = Path(file_path)

        if file_type == "txt" or file_type == "md":
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()

        elif file_type == "pdf":
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(file_path)
                text = ""
                for page in doc:
                    text += page.get_text() + "\n"
                doc.close()
                return text
            except ImportError:
                # Fallback to pypdf
                from pypdf import PdfReader
                reader = PdfReader(file_path)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text

        elif file_type == "docx":
            from docx import Document
            doc = Document(file_path)
            return "\n".join([para.text for para in doc.paragraphs])

        elif file_type in ("xlsx", "xls", "csv"):
            import pandas as pd
            if file_type == "csv":
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)
            return df.to_string()

        return ""

    async def add_document(
        self,
        title: str,
        content: str,
        doc_type: str = "other",
        metadata: Optional[dict] = None,
        source_file: Optional[str] = None
    ) -> dict:
        """Add a document to the knowledge base."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        safe_title = re.sub(r'[^\w\s-]', '', title)[:30].replace(' ', '_')
        doc_id = f"doc_{timestamp}_{safe_title}"

        content_hash = self._get_content_hash(content)

        # Get chunk config for document type
        config = CHUNK_CONFIG.get(doc_type, CHUNK_CONFIG["other"])
        chunks = self._split_text(content, config["size"], config["overlap"])

        if not chunks:
            return {"error": "No content to index", "doc_id": doc_id}

        base_metadata = {
            "doc_id": doc_id,
            "title": title,
            "doc_type": doc_type,
            "content_hash": content_hash,
            "created_at": datetime.now().isoformat(),
            "total_chunks": len(chunks),
            "source_file": source_file or "",
            "status": "indexed"
        }
        if metadata:
            base_metadata.update(metadata)

        # Save metadata file
        meta_file = self.docs_dir / f"{doc_id}.meta.json"
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump({**base_metadata, "content_preview": content[:500]}, f, ensure_ascii=False, indent=2)

        # Check if Ollama is available for embeddings
        use_ollama = await ollama_service.is_available()

        # Index each chunk
        indexed_count = 0
        for i, chunk in enumerate(chunks):
            chunk_id = f"{doc_id}_chunk_{i}"
            chunk_metadata = {**base_metadata, "chunk_index": i}

            if use_ollama:
                embedding = await ollama_service.embed(chunk)
                self.collection.upsert(
                    ids=[chunk_id],
                    embeddings=[embedding],
                    documents=[chunk],
                    metadatas=[chunk_metadata]
                )
            else:
                # Use ChromaDB's built-in embedding
                self.collection.upsert(
                    ids=[chunk_id],
                    documents=[chunk],
                    metadatas=[chunk_metadata]
                )
            indexed_count += 1

        logger.info(f"Indexed document '{title}' with {indexed_count} chunks (Ollama: {use_ollama})")

        return {
            "doc_id": doc_id,
            "title": title,
            "chunks": indexed_count,
            "doc_type": doc_type,
            "content_hash": content_hash,
            "embedding_source": "ollama" if use_ollama else "chromadb"
        }

    async def add_file(
        self,
        file_path: str,
        title: str,
        doc_type: str = "other",
        metadata: Optional[dict] = None
    ) -> dict:
        """Add a file to the knowledge base."""
        path = Path(file_path)
        file_type = path.suffix.lower().lstrip('.')

        # Extract text
        content = await self.extract_text(file_path, file_type)
        if not content.strip():
            return {"error": "Could not extract text from file"}

        return await self.add_document(
            title=title,
            content=content,
            doc_type=doc_type,
            metadata=metadata,
            source_file=path.name
        )

    async def delete_document(self, doc_id: str) -> bool:
        """Delete a document and all its chunks."""
        # Get all chunks for this document
        results = self.collection.get(
            where={"doc_id": doc_id},
            include=["metadatas"]
        )

        if results["ids"]:
            self.collection.delete(ids=results["ids"])

            # Remove metadata file
            meta_file = self.docs_dir / f"{doc_id}.meta.json"
            if meta_file.exists():
                meta_file.unlink()

            logger.info(f"Deleted document {doc_id}")
            return True
        return False

    async def search(
        self,
        query: str,
        top_k: int = 5,
        doc_type: Optional[str] = None,
        min_score: float = 0.0
    ) -> List[dict]:
        """Search the knowledge base."""
        use_ollama = await ollama_service.is_available()

        where_filter = None
        if doc_type:
            where_filter = {"doc_type": doc_type}

        if use_ollama:
            embedding = await ollama_service.embed(query)
            results = self.collection.query(
                query_embeddings=[embedding],
                n_results=top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
        else:
            results = self.collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )

        documents = []
        if results["documents"] and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                score = 1 - results["distances"][0][i] if results["distances"] else 0
                if score >= min_score:
                    documents.append({
                        "content": doc,
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "score": round(score, 4)
                    })

        return documents

    def list_documents(self) -> List[dict]:
        """List all documents in the knowledge base."""
        results = self.collection.get(include=["metadatas"])

        # Group by doc_id
        docs = {}
        for metadata in results["metadatas"]:
            doc_id = metadata.get("doc_id")
            if doc_id and doc_id not in docs:
                docs[doc_id] = {
                    "doc_id": doc_id,
                    "title": metadata.get("title", "Без названия"),
                    "doc_type": metadata.get("doc_type", "other"),
                    "created_at": metadata.get("created_at"),
                    "chunks": metadata.get("total_chunks", 1),
                    "status": metadata.get("status", "indexed")
                }

        return sorted(docs.values(), key=lambda x: x.get("created_at", ""), reverse=True)

    async def get_context_for_query(
        self,
        query: str,
        max_tokens: int = 2000,
        doc_types: Optional[List[str]] = None
    ) -> str:
        """Get relevant context from knowledge base for AI chat."""
        results = await self.search(query, top_k=5)

        if doc_types:
            results = [r for r in results if r["metadata"].get("doc_type") in doc_types]

        context_parts = []
        current_length = 0

        for result in results:
            content = result["content"]
            title = result["metadata"].get("title", "")
            doc_type = result["metadata"].get("doc_type", "")
            score = result["score"]

            # Approximate token count
            content_length = len(content) // 4

            if current_length + content_length > max_tokens:
                break

            context_parts.append(
                f"[Документ: {title} | Тип: {doc_type} | Релевантность: {score:.0%}]\n{content}"
            )
            current_length += content_length

        if not context_parts:
            return ""

        return "\n\n---\n\n".join(context_parts)

    def get_stats(self) -> dict:
        """Get statistics about the knowledge base."""
        results = self.collection.get(include=["metadatas"])

        total_chunks = len(results["ids"])
        doc_ids = set()
        doc_types = {}

        for metadata in results["metadatas"]:
            doc_id = metadata.get("doc_id")
            if doc_id:
                doc_ids.add(doc_id)
            doc_type = metadata.get("doc_type", "other")
            doc_types[doc_type] = doc_types.get(doc_type, 0) + 1

        return {
            "total_documents": len(doc_ids),
            "total_chunks": total_chunks,
            "by_type": doc_types,
            "collection_name": "npf_knowledge_base"
        }


# Singleton instance
document_service = DocumentService()
