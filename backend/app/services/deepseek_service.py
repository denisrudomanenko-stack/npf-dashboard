import httpx
from typing import List, AsyncGenerator, Optional
import json
import logging

logger = logging.getLogger(__name__)


class DeepSeekService:
    """Service for interacting with DeepSeek API (OpenAI-compatible)."""

    BASE_URL = "https://api.deepseek.com/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.model = "deepseek-chat"  # or "deepseek-reasoner" for R1
        self._available = None

    @property
    def headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def is_configured(self) -> bool:
        """Check if DeepSeek API is configured."""
        return bool(self.api_key and self.api_key.startswith("sk-"))

    async def is_available(self) -> bool:
        """Check if DeepSeek API is available and responding."""
        if not self.is_configured():
            return False

        if self._available is not None:
            return self._available

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/models",
                    headers=self.headers
                )
                if response.status_code == 200:
                    self._available = True
                    logger.info("DeepSeek API available")
                    return True
                else:
                    logger.warning(f"DeepSeek API returned status {response.status_code}")
        except Exception as e:
            logger.warning(f"DeepSeek API not available: {e}")

        self._available = False
        return False

    async def chat(
        self,
        messages: List[dict],
        system: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7
    ) -> str:
        """Send chat request to DeepSeek API."""
        if not self.is_configured():
            raise ValueError("DeepSeek API not configured")

        formatted_messages = []
        if system:
            formatted_messages.append({"role": "system", "content": system})
        formatted_messages.extend(messages)

        payload = {
            "model": self.model,
            "messages": formatted_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers=self.headers,
                    json=payload
                )
                response.raise_for_status()
                data = response.json()

                choices = data.get("choices", [])
                if choices:
                    message = choices[0].get("message", {})
                    return message.get("content", "")

                return ""
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 402:
                logger.warning("DeepSeek API: insufficient balance (402)")
                raise ValueError("DeepSeek API: недостаточно средств на балансе")
            raise

    async def chat_stream(
        self,
        messages: List[dict],
        system: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        """Stream chat response from DeepSeek API."""
        if not self.is_configured():
            raise ValueError("DeepSeek API not configured")

        formatted_messages = []
        if system:
            formatted_messages.append({"role": "system", "content": system})
        formatted_messages.extend(messages)

        payload = {
            "model": self.model,
            "messages": formatted_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.BASE_URL}/chat/completions",
                headers=self.headers,
                json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue

    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        max_tokens: int = 2000
    ) -> str:
        """Generate text using simple prompt format."""
        messages = [{"role": "user", "content": prompt}]
        return await self.chat(messages, system=system, max_tokens=max_tokens)


# Singleton instance
from app.config import settings

deepseek_service = DeepSeekService(
    api_key=getattr(settings, 'deepseek_api_key', None)
)
