import os
from typing import List, Optional, AsyncGenerator
import chromadb
from chromadb.config import Settings
import anthropic
from dotenv import load_dotenv

from app.schemas.rag import RAGResponse, RAGSource, ChatMessage
from app.models.document import DocumentType

load_dotenv()


class RAGService:
    def __init__(self):
        self.chroma_client = chromadb.PersistentClient(
            path=os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_db"),
            settings=Settings(anonymized_telemetry=False)
        )
        self.collection = self.chroma_client.get_or_create_collection(
            name="npf_documents",
            metadata={"hnsw:space": "cosine"}
        )
        self.anthropic_client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )

    async def index_document(self, document_id: int, file_path: str, file_type: str) -> int:
        """Extract text, chunk it, and index in ChromaDB"""
        text = await self._extract_text(file_path, file_type)
        chunks = self._chunk_text(text)

        if not chunks:
            return 0

        ids = [f"doc_{document_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{"document_id": document_id, "chunk_index": i} for i in range(len(chunks))]

        self.collection.add(
            documents=chunks,
            ids=ids,
            metadatas=metadatas
        )

        return len(chunks)

    async def delete_document_chunks(self, document_id: int):
        """Delete all chunks for a document"""
        self.collection.delete(
            where={"document_id": document_id}
        )

    async def _extract_text(self, file_path: str, file_type: str) -> str:
        """Extract text from various file formats"""
        if file_type == "txt":
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()

        elif file_type == "pdf":
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

    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into overlapping chunks"""
        if not text:
            return []

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            if chunk.strip():
                chunks.append(chunk.strip())
            start = end - overlap

        return chunks

    async def query(
        self,
        query: str,
        top_k: int = 5,
        document_types: Optional[List[DocumentType]] = None
    ) -> RAGResponse:
        """Query the RAG system"""
        # Search in ChromaDB
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k
        )

        # Build context from results
        context_parts = []
        sources = []

        if results["documents"] and results["documents"][0]:
            for i, (doc, metadata, distance) in enumerate(zip(
                results["documents"][0],
                results["metadatas"][0],
                results["distances"][0]
            )):
                context_parts.append(f"[Источник {i+1}]: {doc}")
                sources.append(RAGSource(
                    document_id=metadata["document_id"],
                    document_title=f"Document {metadata['document_id']}",
                    chunk_text=doc[:200] + "..." if len(doc) > 200 else doc,
                    relevance_score=1 - distance  # Convert distance to similarity
                ))

        context = "\n\n".join(context_parts)

        # Generate answer with Claude
        system_prompt = """Ты - эксперт в области негосударственного пенсионного обеспечения (НПО) и корпоративных пенсионных программ (КПП).
Отвечай на вопросы, используя предоставленный контекст. Если информации недостаточно, честно скажи об этом.
Отвечай на русском языке."""

        message = self.anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": f"Контекст:\n{context}\n\nВопрос: {query}"
                }
            ]
        )

        return RAGResponse(
            answer=message.content[0].text,
            sources=sources
        )

    async def chat(self, messages: List[ChatMessage]) -> dict:
        """Chat with RAG-powered assistant"""
        # Get the last user message for context retrieval
        last_user_message = next(
            (m.content for m in reversed(messages) if m.role == "user"),
            ""
        )

        # Retrieve relevant context
        results = self.collection.query(
            query_texts=[last_user_message],
            n_results=3
        )

        context = ""
        if results["documents"] and results["documents"][0]:
            context = "\n\n".join(results["documents"][0])

        system_prompt = f"""Ты - AI-ассистент для НПФ (негосударственного пенсионного фонда).
Помогаешь с вопросами о корпоративных пенсионных программах, ПДС, и развитии бизнеса.

Релевантный контекст из базы знаний:
{context}

Отвечай на русском языке, кратко и по существу."""

        api_messages = [{"role": m.role, "content": m.content} for m in messages]

        response = self.anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=api_messages
        )

        return {
            "role": "assistant",
            "content": response.content[0].text
        }

    async def chat_stream(self, messages: List[ChatMessage]) -> AsyncGenerator[dict, None]:
        """Streaming chat"""
        last_user_message = next(
            (m.content for m in reversed(messages) if m.role == "user"),
            ""
        )

        results = self.collection.query(
            query_texts=[last_user_message],
            n_results=3
        )

        context = ""
        if results["documents"] and results["documents"][0]:
            context = "\n\n".join(results["documents"][0])

        system_prompt = f"""Ты - AI-ассистент для НПФ.
Контекст: {context}
Отвечай на русском."""

        api_messages = [{"role": m.role, "content": m.content} for m in messages]

        with self.anthropic_client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=api_messages
        ) as stream:
            for text in stream.text_stream:
                yield {"content": text}

    async def get_stats(self) -> dict:
        """Get statistics about the RAG system"""
        count = self.collection.count()
        return {
            "total_chunks": count,
            "collection_name": "npf_documents"
        }
