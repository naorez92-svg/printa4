"""Incoming message routing — by message type and user conversation state."""
import logging
import re
from datetime import datetime, time as dtime

from sqlalchemy.orm import Session

from server import messaging
from server.db import crud
from server.db.models import User
from server.db.session import get_session
from server.engine import onboarding, prompts, state
from server.integrations.anthropic_llm import llm_text
from server.integrations.whisper import transcribe
from server.utils import hebrew
from server.utils.timeutil import local_now

logger = logging.getLogger(__name__)

MEDICAL_KEYWORDS = (
    "תרופה", "תרופות", "הפרעת אכילה", "הקאה", "הקאות", "הרעבה", "מרעיב",
    "אנורקסיה", "בולימיה", "סוכרת", "לחץ דם", "הריון", "בהריון",
)

RESUME_AFTER_PAUSE = "יופי שחזרת! אפס אשמה. מוחקים את הימים האלה ומתחילים מהיום. מה על הפרק?"
CHURNED_INVITE = "הדלת פתוחה 🙂 כתוב \"התחל\" ונתחיל מחדש."


def _contains_medical(text: str) -> bool:
    return any(k in text for k in MEDICAL_KEYWORDS)


def process_incoming(
    phone: str, msg_type: str, *, text: str | None = None,
    image_b64: str | None = None, audio_bytes: bytes | None = None,
    wa_message_id: str | None = None, now: datetime | None = None,
) -> list[str]:
    """Handle one inbound message end-to-end. Returns the reply texts sent."""
    session = get_session()
    try:
        now = now or local_now()
        user, created = crud.get_or_create_user(session, phone)
        if user.status == "blocked":
            return []

        content_note = text if msg_type == "text" else f"[{msg_type}]"
        inbound = crud.record_inbound(session, user, msg_type, content_note, wa_message_id, now=now)
        if inbound is None:  # duplicate webhook delivery — 200 + silence
            return []

        replies = _route(session, user, created, msg_type, text, image_b64, audio_bytes, now)
        for r in replies:
            messaging.send_text(session, user, r)
        return replies
    except Exception:
        logger.exception("failed processing message from %s", phone)
        return []
    finally:
        session.close()


def _route(
    session: Session, user: User, created: bool, msg_type: str,
    text: str | None, image_b64: str | None, audio_bytes: bytes | None,
    now: datetime,
) -> list[str]:
    if msg_type == "unsupported":
        return [prompts.UNSUPPORTED_TYPE]

    if msg_type == "voice":
        text = transcribe(session, user, audio_bytes or b"")
        if not text:
            return [prompts.VOICE_FALLBACK]

    norm = hebrew.normalize(text or "")

    # brand-new user, or an explicit restart
    if created:
        return onboarding.start(session, user)
    if norm == "התחל":
        if user.status in ("churned", "onboarding"):
            return onboarding.start(session, user)
        if user.status == "paused":
            user.status = "active"
            user.missed_days_streak = 0
            session.commit()
            return [RESUME_AFTER_PAUSE]
        return [prompts.HELP_MENU]

    if user.status == "churned":
        return [CHURNED_INVITE]

    # medical content → referral + support-only mode, before anything else
    if norm and _contains_medical(norm):
        user.medical_flag = True
        session.commit()
        return [prompts.MEDICAL_REFERRAL]

    if user.status == "onboarding":
        if msg_type == "image":
            return ["נסיים קודם את ההיכרות 🙂 " + prompts.ONBOARDING_QUESTIONS.get(
                (state.get_state(user) or "").removeprefix(state.ONBOARDING_PREFIX), ""
            ).format(name=user.name or "")]
        return onboarding.handle(session, user, norm)

    # paused user writing anything (except stop/delete) comes back with zero guilt
    if user.status == "paused":
        command_replies = _try_commands(session, user, norm, now)
        if command_replies is not None:
            return command_replies
        user.status = "active"
        user.missed_days_streak = 0
        session.commit()
        return [RESUME_AFTER_PAUSE]

    # --- active user ---
    command_replies = _try_commands(session, user, norm, now)
    if command_replies is not None:
        return command_replies

    from server.engine import meals, planner  # lazy: stage modules

    if msg_type == "image":
        return meals.handle_photo(session, user, image_b64 or "", now)

    if state.get_state(user) == state.AWAITING_PLAN_CONTEXT:
        return planner.handle_context_reply(session, user, norm, now)
    if state.get_state(user) == state.AWAITING_MEAL_CLARIFICATION:
        return meals.handle_clarification(session, user, norm, now)
    if state.get_state(user) == state.AWAITING_EMOTIONAL_ANSWER:
        return meals.handle_emotional_answer(session, user, norm, now)

    source = "voice" if msg_type == "voice" else "text"
    return meals.handle_free_text(session, user, norm, now, source=source)


def _try_commands(session: Session, user: User, norm: str, now: datetime) -> list[str] | None:
    """Fixed text commands (build-plan 5.7). Returns None when no command matched."""
    if not norm:
        return None
    low = norm.lower().rstrip("!.")

    if low == "עצור":
        user.status = "paused"
        state.clear_state(session, user)
        session.commit()
        return [prompts.STOP_REPLY]

    if low in ("הסר", "מחק אותי", "הסר אותי"):
        crud.delete_user_data(session, user)
        return [prompts.DELETE_REPLY]

    if low in ("תפריט", "עזרה"):
        return [prompts.HELP_MENU]

    m = re.match(r"^משקל\s+(\d+(?:[.,]\d+)?)$", norm)
    if m:
        weight = float(m.group(1).replace(",", "."))
        crud.log_weight(session, user, now.date(), weight)
        return [prompts.WEIGHT_LOGGED_REPLY.format(weight=m.group(1))]

    m = re.match(r"^שעה\s+(\d{1,2})(?::(\d{2}))?$", norm)
    if m:
        hour, minute = int(m.group(1)), int(m.group(2) or 0)
        if 0 <= hour < 24 and 0 <= minute < 60:
            user.morning_hour = dtime(hour, minute)
            session.commit()
            return [prompts.HOUR_UPDATED_REPLY.format(hour=f"{hour:02d}:{minute:02d}")]

    return None


def coach_chat(session: Session, user: User, text: str) -> list[str]:
    """Free-form coach reply (≤3 sentences per COACH_SYSTEM)."""
    reply = llm_text(session, user, prompts.COACH_SYSTEM, text)
    return [reply or prompts.TEMPLATE_FALLBACK_REPLY]
