"""עטיפת Anthropic API — הנקודה היחידה שמדברת עם ה-LLM.

עיקרון סעיף 2 במסמך האב: ה-LLM מפרש כוונה ומנסח טקסט. הוא לעולם לא מקור
לערך מספרי הנדסי — אלה מגיעים רק מהמודולים הדטרמיניסטיים.
"""
from __future__ import annotations

import json
import re

from .config import settings


class LLMUnavailable(Exception):
    """אין מפתח API — הפיצ'רים הדטרמיניסטיים ממשיכים לעבוד בלעדיו."""


_client = None


def get_client():
    global _client
    if not settings.anthropic_api_key:
        raise LLMUnavailable(
            "חסר מפתח ANTHROPIC_API_KEY בקובץ ‎.env‎ — "
            "פיצ'רים מבוססי AI (צ'אט, קורא שרטוטים, CAD מתיאור חופשי) דורשים אותו."
        )
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def complete(system: str, messages: list[dict], max_tokens: int = 4096,
             tools: list[dict] | None = None):
    """קריאה בודדת ל-Claude. מחזיר את אובייקט התגובה המלא."""
    client = get_client()
    kwargs: dict = {
        "model": settings.mechmind_model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": messages,
    }
    if tools:
        kwargs["tools"] = tools
    return client.messages.create(**kwargs)


def text_of(response) -> str:
    return "".join(b.text for b in response.content if getattr(b, "type", "") == "text")


def extract_json(text: str) -> dict | list | None:
    """שולף JSON מתשובת LLM — גם אם עטוף בגדר קוד או בטקסט."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = min((i for i in (text.find("{"), text.find("[")) if i != -1), default=-1)
    if start == -1:
        return None
    for end in range(len(text), start, -1):
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            continue
    return None
