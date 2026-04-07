import logging
import os
from typing import Protocol, runtime_checkable

from google import genai

logger = logging.getLogger(__name__)


@runtime_checkable
class LLMProvider(Protocol):
    async def explain(self, prompt: str) -> str: ...


class GeminiProvider:
    def __init__(self, api_key: str, model: str):
        self._client = genai.Client(api_key=api_key)
        self._model = model

    async def explain(self, prompt: str) -> str:
        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=prompt,
        )
        return response.text.strip()


_provider: LLMProvider | None = None


def init_provider() -> None:
    global _provider
    api_key = os.environ.get("GEMINI_API_KEY", "")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    if api_key:
        _provider = GeminiProvider(api_key, model)
        logger.info("LLM provider: Gemini (%s)", model)
    else:
        logger.info("LLM provider: none (GEMINI_API_KEY not set — using templates)")


def set_provider(provider: LLMProvider | None) -> None:
    """Override provider — for testing."""
    global _provider
    _provider = provider


async def get_explanation(
    pre_move_fen: str,
    played_san: str,
    best_san: str,
    cp_loss: int,
    quality: str,
) -> tuple[str | None, str]:
    """
    Returns (explanation, llm_debug).
    explanation is None if no provider or call failed — caller falls back to template.
    llm_debug is always a human-readable string for the debug panel.
    """
    if _provider is None:
        return None, "LLM: fallback (no provider configured)"
    quality_word = "blunder" if quality == "blunder" else "mistake"
    prompt = (
        f"Chess position (FEN: {pre_move_fen}). "
        f"The player played {played_san} instead of {best_san} (-{cp_loss}cp). "
        f"In one casual sentence, explain why {played_san} was a {quality_word}. "
        f"Be direct and concise. Do not mention the best move."
    )
    try:
        logger.info("Gemini called. Prompt: %s", prompt)
        result = await _provider.explain(prompt)
        logger.info("Gemini response: %s", result)
        return result, f"LLM: Gemini called.\nPrompt: {prompt}\nResponse: {result}"
    except Exception as exc:
        logger.warning("Gemini call failed: %s", exc)
        return None, f"LLM: Gemini failed ({exc})"
