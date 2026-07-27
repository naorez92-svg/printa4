"""Incoming message routing — by message type and user conversation state.

Stage 1: dedup + persist + echo. Real routing arrives with the engine stages.
"""
import logging
from datetime import datetime

from server.db import crud
from server.db.session import get_session
from server import messaging

logger = logging.getLogger(__name__)


def process_incoming(
    phone: str, msg_type: str, *, text: str | None = None,
    image_b64: str | None = None, audio_bytes: bytes | None = None,
    wa_message_id: str | None = None, now: datetime | None = None,
) -> list[str]:
    """Handle one inbound message end-to-end. Returns the reply texts sent."""
    session = get_session()
    try:
        user, _created = crud.get_or_create_user(session, phone)
        if user.status == "blocked":
            return []
        inbound = crud.record_inbound(session, user, msg_type, text, wa_message_id, now=now)
        if inbound is None:  # duplicate webhook delivery — 200 + silence
            return []
        reply = f"קיבלתי: {text}" if text else "קיבלתי 🙂"
        messaging.send_text(session, user, reply)
        return [reply]
    finally:
        session.close()
