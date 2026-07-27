"""ElevenLabs TTS — used only for the morning message and the weekly summary."""
import logging

import requests

from server.config import get_settings
from server.integrations import mocks
from server.utils import cost_guard

logger = logging.getLogger(__name__)


def synthesize(session, user, text: str) -> bytes | None:
    """Returns mp3 bytes, or None → caller falls back to text only."""
    settings = get_settings()
    if not cost_guard.allow_tts(session, user):
        return None
    if settings.mock_mode:
        cost_guard.note_call(session, user, "elevenlabs")
        return mocks.mock_tts(text)
    if not settings.elevenlabs_api_key or not settings.elevenlabs_voice_id:
        return None  # no key → everything stays text (cost + simplicity)
    try:
        resp = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{settings.elevenlabs_voice_id}",
            headers={"xi-api-key": settings.elevenlabs_api_key},
            json={"text": text, "model_id": "eleven_multilingual_v2"},
            timeout=60,
        )
        resp.raise_for_status()
        cost_guard.note_call(session, user, "elevenlabs")
        return resp.content
    except Exception:
        logger.exception("ElevenLabs TTS failed")
        return None
