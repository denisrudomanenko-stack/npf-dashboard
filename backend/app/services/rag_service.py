from typing import List, Optional, AsyncGenerator
import anthropic
import os
import logging

from app.services.document_service import document_service
from app.services.ollama_service import ollama_service
from app.schemas.rag import RAGResponse, RAGSource, ChatMessage

logger = logging.getLogger(__name__)


# System prompts for NPF assistant
NPF_SYSTEM_PROMPT = """Ты - эксперт в области негосударственного пенсионного обеспечения (НПО) и Wealth Management.

Твоя специализация:
- Программа долгосрочных сбережений (ПДС)
- Корпоративные пенсионные программы (КПП)
- Негосударственные пенсионные фонды (НПФ)
- Продажи накопительных и инвестиционных продуктов через банковские каналы

Правила ответов:
1. Используй ТОЛЬКО информацию из предоставленного контекста базы знаний
2. Если информации недостаточно - честно скажи об этом
3. Отвечай структурированно и по существу
4. Используй профессиональную терминологию НПФ отрасли
5. При цитировании указывай источник документа

Отвечай на русском языке."""


class RAGService:
    """RAG service for NPF knowledge base with multi-provider support."""

    def __init__(self):
        self.anthropic_client = None
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if api_key and api_key != "your-api-key-here":
            self.anthropic_client = anthropic.Anthropic(api_key=api_key)

    async def _get_provider(self) -> str:
        """Determine which LLM provider to use."""
        if await ollama_service.is_available():
            return "ollama"
        elif self.anthropic_client:
            return "anthropic"
        return "none"

    async def query(
        self,
        query: str,
        top_k: int = 5,
        doc_types: Optional[List[str]] = None
    ) -> RAGResponse:
        """Query the RAG system and generate an answer."""
        # Search knowledge base
        results = await document_service.search(query, top_k=top_k)

        if doc_types:
            results = [r for r in results if r["metadata"].get("doc_type") in doc_types]

        # Build context
        context_parts = []
        sources = []

        for i, result in enumerate(results):
            context_parts.append(f"[Источник {i+1}]: {result['content']}")
            sources.append(RAGSource(
                document_id=result["metadata"].get("doc_id", "unknown"),
                document_title=result["metadata"].get("title", "Документ"),
                chunk_text=result["content"][:200] + "..." if len(result["content"]) > 200 else result["content"],
                relevance_score=result["score"]
            ))

        context = "\n\n".join(context_parts)

        if not context:
            return RAGResponse(
                answer="В базе знаний не найдено релевантной информации по вашему запросу.",
                sources=[]
            )

        # Generate answer
        prompt = f"""Контекст из базы знаний:
{context}

Вопрос пользователя: {query}

Ответь на вопрос, используя только информацию из контекста выше."""

        provider = await self._get_provider()

        if provider == "ollama":
            answer = await ollama_service.generate(prompt, system=NPF_SYSTEM_PROMPT)
        elif provider == "anthropic":
            message = self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=NPF_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}]
            )
            answer = message.content[0].text
        else:
            answer = f"LLM провайдер недоступен. Найдено {len(sources)} релевантных документов."

        return RAGResponse(answer=answer, sources=sources)

    async def chat(self, messages: List[ChatMessage], use_rag: bool = True) -> dict:
        """Chat with optional RAG-powered assistant."""
        from app.config import settings

        # Determine which model to use based on settings
        chat_provider = getattr(settings, 'chat_provider', 'ollama')
        chat_model = getattr(settings, 'anthropic_chat_model', 'claude-sonnet-4-20250514') if chat_provider == 'anthropic' else ollama_service.model

        system_prompt = NPF_SYSTEM_PROMPT

        # Only add RAG context if enabled
        if use_rag:
            last_user_message = next(
                (m.content for m in reversed(messages) if m.role == "user"),
                ""
            )
            context = await document_service.get_context_for_query(last_user_message)
            if context:
                system_prompt += f"\n\n{'='*50}\nКОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ (ПРИОРИТЕТНЫЙ ИСТОЧНИК):\n{'='*50}\n{context}\n\nИспользуй информацию из базы знаний как основной источник для ответа."
        else:
            system_prompt = """Ты - эксперт в области негосударственного пенсионного обеспечения (НПО) и Wealth Management.
Отвечай на вопросы используя свои знания. Отвечай на русском языке."""

        api_messages = [{"role": m.role, "content": m.content} for m in messages]

        # Use configured provider
        if chat_provider == "anthropic" and self.anthropic_client:
            message = self.anthropic_client.messages.create(
                model=chat_model,
                max_tokens=2048,
                system=system_prompt,
                messages=api_messages
            )
            response = message.content[0].text
        elif await ollama_service.is_available():
            response = await ollama_service.chat(api_messages, system=system_prompt)
        elif self.anthropic_client:
            message = self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=system_prompt,
                messages=api_messages
            )
            response = message.content[0].text
        else:
            response = "LLM провайдер недоступен. Пожалуйста, запустите Ollama или настройте ANTHROPIC_API_KEY."

        return {"role": "assistant", "content": response}

    async def chat_stream(self, messages: List[ChatMessage]) -> AsyncGenerator[dict, None]:
        """Streaming chat with RAG."""
        last_user_message = next(
            (m.content for m in reversed(messages) if m.role == "user"),
            ""
        )

        context = await document_service.get_context_for_query(last_user_message)

        system_prompt = NPF_SYSTEM_PROMPT
        if context:
            system_prompt += f"\n\nКонтекст:\n{context}"

        api_messages = [{"role": m.role, "content": m.content} for m in messages]

        provider = await self._get_provider()

        if provider == "ollama":
            async for chunk in ollama_service.chat_stream(api_messages, system=system_prompt):
                yield {"content": chunk}
        elif provider == "anthropic":
            with self.anthropic_client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=system_prompt,
                messages=api_messages
            ) as stream:
                for text in stream.text_stream:
                    yield {"content": text}
        else:
            yield {"content": "LLM провайдер недоступен."}

    async def get_stats(self) -> dict:
        """Get RAG system statistics."""
        doc_stats = document_service.get_stats()
        provider = await self._get_provider()

        return {
            **doc_stats,
            "llm_provider": provider,
            "ollama_available": await ollama_service.is_available(),
            "anthropic_configured": self.anthropic_client is not None
        }


# Singleton instance
rag_service = RAGService()
