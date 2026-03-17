import json
from typing import Any, Dict

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings


class LLMClient:
    """
    Thin wrapper around an LLM HTTP API (e.g. OpenAI-compatible).

    This is intentionally minimal and can be swapped out later
    for provider-specific SDKs or LangChain.
    """

    def __init__(self) -> None:
        self._api_key = settings.groq_api_key
        self._model = settings.groq_model
        # Groq exposes an OpenAI-compatible API under this base URL.
        self._base_url = "https://api.groq.com/openai/v1/chat/completions"

    @retry(wait=wait_exponential(multiplier=1, min=1, max=10), stop=stop_after_attempt(3))
    async def complete_json(self, prompt: str, transcript: str) -> Dict[str, Any]:
        """
        Call the LLM with a system-style prompt and the transcript as user content,
        expecting a pure JSON object in the response.
        """
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        body = {
            "model": self._model,
            "temperature": settings.llm_temperature,
            "max_tokens": settings.llm_max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": transcript},
            ],
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(self._base_url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"]["content"]
        # response_format=json_object should guarantee valid JSON, but we still guard.
        return json.loads(content)


llm_client = LLMClient()

