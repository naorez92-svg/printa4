"""Outbound messaging helpers: send + record in messages table."""
from sqlalchemy.orm import Session

from server.db import crud
from server.db.models import User
from server.integrations.green_api import get_wa_client


def send_text(session: Session, user: User, text: str) -> None:
    get_wa_client().send_text(user.phone, text)
    crud.record_outbound(session, user, "text", text)


def send_voice_with_text(session: Session, user: User, text: str, allow_tts: bool = True) -> None:
    """Voice note (TTS) + identical text. Falls back to text-only when TTS is
    unavailable (missing key / cap reached / voice disabled)."""
    from server.integrations.tts import synthesize  # lazy: avoid cycle at import time

    audio = synthesize(session, user, text) if (allow_tts and user.voice_enabled) else None
    client = get_wa_client()
    if audio:
        client.send_voice(user.phone, audio, caption=None)
        crud.record_outbound(session, user, "voice", text)
    client.send_text(user.phone, text)
    crud.record_outbound(session, user, "text", text)
