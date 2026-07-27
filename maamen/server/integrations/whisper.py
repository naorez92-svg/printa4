"""OpenAI Whisper transcription for inbound voice notes."""
import logging

import requests

from server.config import get_settings
from server.integrations import mocks
from server.utils import cost_guard

logger = logging.getLogger(__name__)


def transcribe(session, user, audio: bytes) -> str | None:
    """Returns Hebrew text, or None → caller sends the 'write it instead' fallback."""
    settings = get_settings()
    if settings.mock_mode:
        cost_guard.note_call(session, None, "openai")
        return mocks.mock_transcribe(audio)
    if not settings.openai_api_key:
        return None
    try:
        resp = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            files={"file": ("voice.ogg", audio, "audio/ogg")},
            data={"model": "whisper-1", "language": "he"},
            timeout=60,
        )
        resp.raise_for_status()
        cost_guard.note_call(session, None, "openai")
        return resp.json().get("text", "").strip() or None
    except Exception:
        logger.exception("Whisper transcription failed")
        return None
