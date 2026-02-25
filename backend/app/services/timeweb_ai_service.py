import httpx
from typing import List, AsyncGenerator, Optional
import json
import logging

logger = logging.getLogger(__name__)


class TimewebAIService:
    """Service for interacting with Timeweb Cloud AI (OpenAI-compatible API)."""

    BASE_URL = "https://agent.timeweb.cloud/api/v1/cloud-ai/agents"

    def __init__(
        self,
        agent_id: Optional[str] = None,
        agent_id_no_rag: Optional[str] = None,
        token: Optional[str] = None
    ):
        self.agent_id = agent_id  # Agent with RAG (OpenSearch)
        self.agent_id_no_rag = agent_id_no_rag  # Agent without RAG
        self.token = token
        self.model = "deepseek-reasoner"
        self._available = None
        self._available_no_rag = None

    @property
    def api_url(self) -> str:
        return f"{self.BASE_URL}/{self.agent_id}/v1"

    @property
    def headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def is_configured(self, use_rag: bool = True) -> bool:
        """Check if Timeweb AI is configured."""
        if use_rag:
            return bool(self.agent_id and self.token)
        else:
            return bool(self.agent_id_no_rag and self.token)

    async def is_available(self, use_rag: bool = True) -> bool:
        """Check if Timeweb AI is available and responding."""
        if not self.is_configured(use_rag):
            return False

        # Check cache
        if use_rag and self._available is not None:
            return self._available
        if not use_rag and self._available_no_rag is not None:
            return self._available_no_rag

        agent_id = self.agent_id if use_rag else self.agent_id_no_rag
        api_url = f"{self.BASE_URL}/{agent_id}/v1"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{api_url}/models",
                    headers=self.headers
                )
                if response.status_code == 200:
                    data = response.json()
                    models = data.get("data", [])
                    if models:
                        self.model = models[0].get("id", self.model)
                        if use_rag:
                            self._available = True
                        else:
                            self._available_no_rag = True
                        logger.info(f"Timeweb AI {'RAG' if use_rag else 'Direct'} available with model: {self.model}")
                        return True
                else:
                    logger.warning(f"Timeweb AI returned status {response.status_code}")
        except Exception as e:
            logger.warning(f"Timeweb AI not available: {e}")

        if use_rag:
            self._available = False
        else:
            self._available_no_rag = False
        return False

    async def call_agent(
        self,
        message: str,
        parent_message_id: Optional[str] = None,
        use_rag: bool = True
    ) -> dict:
        """Call agent with or without RAG support.

        Returns dict with 'message', 'id', and 'finish_reason'.
        """
        if not self.is_configured(use_rag):
            raise ValueError("Timeweb AI not configured")

        agent_id = self.agent_id if use_rag else self.agent_id_no_rag

        payload = {"message": message}
        if parent_message_id:
            payload["parent_message_id"] = parent_message_id

        call_url = f"{self.BASE_URL}/{agent_id}/call"

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                call_url,
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            return response.json()

    async def chat(
        self,
        messages: List[dict],
        system: Optional[str] = None,
        max_tokens: int = 2000,
        use_rag: bool = True
    ) -> str:
        """Send chat request to Timeweb AI.

        - use_rag=True: Uses /call endpoint (RAG agent with OpenSearch)
        - use_rag=False: Uses /chat/completions endpoint (direct chat, no RAG)
        """
        if not self.is_configured(use_rag):
            raise ValueError("Timeweb AI not configured")

        agent_id = self.agent_id if use_rag else self.agent_id_no_rag

        # RAG mode: use /call endpoint
        if use_rag:
            last_user_message = ""
            for msg in reversed(messages):
                if msg.get("role") == "user":
                    last_user_message = msg.get("content", "")
                    break

            if last_user_message:
                try:
                    result = await self.call_agent(last_user_message, use_rag=True)
                    return result.get("message", "")
                except Exception as e:
                    logger.warning(f"Agent /call failed: {e}")
                    raise

        # No-RAG mode: use /chat/completions endpoint with explicit temperature
        api_url = f"{self.BASE_URL}/{agent_id}/v1"

        formatted_messages = []
        if system:
            formatted_messages.append({"role": "system", "content": system})
        formatted_messages.extend(messages)

        payload = {
            "model": self.model,
            "messages": formatted_messages,
            "max_completion_tokens": max_tokens,
            "temperature": 0.7,  # Explicit temperature, no top_p to avoid conflict
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{api_url}/chat/completions",
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

    async def generate_chat_title(self, first_message: str) -> str:
        """Generate a short chat title based on the first user message.

        Returns a title up to 30 characters.
        """
        if not self.is_configured(use_rag=False):
            # Fallback: truncate the message
            title = first_message[:27] + "..." if len(first_message) > 30 else first_message
            return title

        prompt = f"""Сгенерируй короткое название для чата (максимум 30 символов) на основе первого сообщения пользователя.
Название должно отражать суть запроса. Не используй кавычки. Отвечай только названием, без пояснений.

Сообщение пользователя: {first_message[:200]}

Название:"""

        try:
            messages = [{"role": "user", "content": prompt}]
            title = await self.chat(messages, max_tokens=50, use_rag=False)
            # Clean up the title
            title = title.strip().strip('"\'')
            # Ensure max 30 chars
            if len(title) > 30:
                title = title[:27] + "..."
            return title if title else first_message[:27] + "..."
        except Exception as e:
            logger.warning(f"Failed to generate chat title: {e}")
            # Fallback to truncated message
            return first_message[:27] + "..." if len(first_message) > 30 else first_message


# Singleton instance
from app.config import settings

timeweb_ai_service = TimewebAIService(
    agent_id=settings.timeweb_agent_id,
    agent_id_no_rag=getattr(settings, 'timeweb_agent_id_no_rag', None),
    token=settings.timeweb_ai_token
)
