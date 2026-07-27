"""Anthropic LLM wrapper: single retry, 30s timeout, lenient JSON parsing.

Every LLM call goes through here — cost guard first, mock in MOCK_MODE.
"""
import json
import logging
import re

import requests

from server.config import get_settings
from server.db.models import User
from server.integrations import mocks
from server.utils import cost_guard

logger = logging.getLogger(__name__)

API_URL = "https://api.anthropic.com/v1/messages"
ATTEMPTS = 2
TIMEOUT = 30


def lenient_json_parse(text: str) -> dict | None:
    """Extract a JSON object even when wrapped in ```json fences or prose."""
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    candidate = m.group(1) if m else None
    if candidate is None:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end > start:
            candidate = text[start:end + 1]
    if candidate is None:
        return None
    try:
        parsed = json.loads(candidate)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def _call_api(system: str, content, max_tokens: int) -> str | None:
    settings = get_settings()
    if isinstance(content, str):
        content = [{"type": "text", "text": content}]
    body = {
        "model": settings.llm_model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": content}],
    }
    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    for attempt in range(ATTEMPTS):
        try:
            resp = requests.post(API_URL, json=body, headers=headers, timeout=TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            return "".join(b.get("text", "") for b in data.get("content", []))
        except Exception:
            logger.exception("Anthropic call failed (attempt %d/%d)", attempt + 1, ATTEMPTS)
    return None


def llm_text(session, user: User | None, system: str, content, max_tokens: int = 1000) -> str | None:
    """Returns None when blocked by the cost guard or on hard API failure."""
    if user is not None and not cost_guard.allow_llm(session, user):
        return None
    if get_settings().mock_mode:
        result = mocks.mock_llm(system, content, max_tokens)
    else:
        result = _call_api(system, content, max_tokens)
    if result is not None:
        cost_guard.note_call(session, user, "anthropic")
    return result


def llm_json(session, user: User | None, system: str, content, max_tokens: int = 1000) -> dict | None:
    raw = llm_text(session, user, system, content, max_tokens)
    if raw is None:
        return None
    parsed = lenient_json_parse(raw)
    if parsed is None:
        logger.warning("LLM returned unparseable JSON: %.200s", raw)
    return parsed


def image_content(image_b64: str, prompt: str, media_type: str = "image/jpeg") -> list:
    return [
        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
        {"type": "text", "text": prompt},
    ]
