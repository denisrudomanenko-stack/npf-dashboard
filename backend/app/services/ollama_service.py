import httpx
from typing import List, AsyncGenerator, Optional
import json
import logging

logger = logging.getLogger(__name__)


class OllamaService:
    """Service for interacting with Ollama for embeddings and chat."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.model = "qwen2.5:7b"
        self.embed_model = "nomic-embed-text"
        self._available = None

    async def is_available(self) -> bool:
        """Check if Ollama is running and has required models."""
        if self._available is not None:
            return self._available

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    model_names = [m.get("name", "").split(":")[0] for m in models]
                    has_embed = "nomic-embed-text" in model_names
                    has_chat = any(m in model_names for m in ["qwen2.5", "llama3", "mistral"])
                    self._available = has_embed
                    if not has_embed:
                        logger.warning("nomic-embed-text model not found in Ollama")
                    return self._available
        except Exception as e:
            logger.warning(f"Ollama not available: {e}")
            self._available = False
        return False

    async def embed(self, text: str) -> List[float]:
        """Generate embedding for text using Ollama."""
        if not text.strip():
            return [0.0] * 768  # Return zero vector for empty text

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/embeddings",
                    json={
                        "model": self.embed_model,
                        "prompt": text[:8000],  # Limit text length
                    }
                )
                response.raise_for_status()
                return response.json()["embedding"]
        except Exception as e:
            logger.error(f"Embedding error: {e}")
            # Return zero vector on error
            return [0.0] * 768

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        embeddings = []
        for text in texts:
            embedding = await self.embed(text)
            embeddings.append(embedding)
        return embeddings

    async def generate(self, prompt: str, system: Optional[str] = None) -> str:
        """Generate text using Ollama."""
        async with httpx.AsyncClient(timeout=300.0) as client:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
            }
            if system:
                payload["system"] = system

            response = await client.post(
                f"{self.base_url}/api/generate",
                json=payload
            )
            response.raise_for_status()
            return response.json()["response"]

    async def chat(
        self,
        messages: List[dict],
        system: Optional[str] = None
    ) -> str:
        """Chat with Ollama using message history."""
        async with httpx.AsyncClient(timeout=300.0) as client:
            formatted_messages = []
            if system:
                formatted_messages.append({"role": "system", "content": system})
            formatted_messages.extend(messages)

            response = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": formatted_messages,
                    "stream": False,
                }
            )
            response.raise_for_status()
            return response.json()["message"]["content"]

    async def chat_stream(
        self,
        messages: List[dict],
        system: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Stream chat response from Ollama."""
        async with httpx.AsyncClient(timeout=300.0) as client:
            formatted_messages = []
            if system:
                formatted_messages.append({"role": "system", "content": system})
            formatted_messages.extend(messages)

            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": self.model,
                    "messages": formatted_messages,
                    "stream": True,
                }
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            yield data["message"]["content"]


# Singleton instance - use settings for base URL
from app.config import settings
ollama_service = OllamaService(base_url=settings.ollama_base_url)
