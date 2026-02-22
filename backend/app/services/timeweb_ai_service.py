import httpx
from typing import List, AsyncGenerator, Optional
import json
import logging

logger = logging.getLogger(__name__)


class TimewebAIService:
    """Service for interacting with Timeweb Cloud AI (OpenAI-compatible API)."""

    BASE_URL = "https://agent.timeweb.cloud/api/v1/cloud-ai/agents"

    def __init__(self, agent_id: Optional[str] = None, token: Optional[str] = None):
        self.agent_id = agent_id
        self.token = token
        self.model = "deepseek-reasoner"
        self._available = None

    @property
    def api_url(self) -> str:
        return f"{self.BASE_URL}/{self.agent_id}/v1"

    @property
    def headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def is_configured(self) -> bool:
        """Check if Timeweb AI is configured."""
        return bool(self.agent_id and self.token)

    async def is_available(self) -> bool:
        """Check if Timeweb AI is available and responding."""
        if not self.is_configured():
            return False

        if self._available is not None:
            return self._available

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.api_url}/models",
                    headers=self.headers
                )
                if response.status_code == 200:
                    data = response.json()
                    models = data.get("data", [])
                    if models:
                        # Use first available model
                        self.model = models[0].get("id", self.model)
                        self._available = True
                        logger.info(f"Timeweb AI available with model: {self.model}")
                        return True
                else:
                    logger.warning(f"Timeweb AI returned status {response.status_code}")
        except Exception as e:
            logger.warning(f"Timeweb AI not available: {e}")

        self._available = False
        return False

    async def chat(
        self,
        messages: List[dict],
        system: Optional[str] = None,
        max_tokens: int = 2000
    ) -> str:
        """Send chat completion request to Timeweb AI."""
        if not self.is_configured():
            raise ValueError("Timeweb AI not configured")

        formatted_messages = []
        if system:
            formatted_messages.append({"role": "system", "content": system})
        formatted_messages.extend(messages)

        payload = {
            "model": self.model,
            "messages": formatted_messages,
            "max_completion_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.api_url}/chat/completions",
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()

            # Extract response content
            choices = data.get("choices", [])
            if choices:
                message = choices[0].get("message", {})
                return message.get("content", "")

            return ""

    async def chat_stream(
        self,
        messages: List[dict],
        system: Optional[str] = None,
        max_tokens: int = 2000
    ) -> AsyncGenerator[str, None]:
        """Stream chat response from Timeweb AI."""
        if not self.is_configured():
            raise ValueError("Timeweb AI not configured")

        formatted_messages = []
        if system:
            formatted_messages.append({"role": "system", "content": system})
        formatted_messages.extend(messages)

        payload = {
            "model": self.model,
            "messages": formatted_messages,
            "max_completion_tokens": max_tokens,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.api_url}/chat/completions",
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

timeweb_ai_service = TimewebAIService(
    agent_id=settings.timeweb_agent_id,
    token=settings.timeweb_ai_token
)
