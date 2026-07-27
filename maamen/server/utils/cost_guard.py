"""API cost guard: daily per-user caps + a global daily cost ceiling.

On breach the bot keeps working with text-only / template replies, logs a
WARNING and the admin dashboard shows a red banner.
"""
import logging
from datetime import date

from sqlalchemy.orm import Session

from server.config import get_settings
from server.db import crud
from server.db.models import User
from server.utils.timeutil import local_today

logger = logging.getLogger(__name__)

# rough per-call cost estimates (USD) — good enough for a guard rail
COST_PER_CALL = {"anthropic": 0.02, "openai": 0.006, "elevenlabs": 0.08}


def global_cost_exceeded(session: Session, day: date | None = None) -> bool:
    day = day or local_today()
    return crud.total_cost_for_day(session, day) >= get_settings().max_daily_cost_usd


def allow_llm(session: Session, user: User, day: date | None = None) -> bool:
    day = day or local_today()
    if global_cost_exceeded(session, day):
        logger.warning("cost guard: global daily cost cap reached — LLM blocked")
        return False
    usage = crud.get_usage(session, user.id, day)
    if usage.llm_calls >= get_settings().max_llm_calls_per_user_per_day:
        logger.warning("cost guard: user %s hit daily LLM cap", user.id)
        return False
    return True


def allow_tts(session: Session, user: User, day: date | None = None) -> bool:
    day = day or local_today()
    if global_cost_exceeded(session, day):
        logger.warning("cost guard: global daily cost cap reached — TTS blocked")
        return False
    usage = crud.get_usage(session, user.id, day)
    if usage.tts_calls >= get_settings().max_tts_per_user_per_day:
        return False
    return True


def note_call(session: Session, user: User | None, provider: str, day: date | None = None) -> None:
    day = day or local_today()
    crud.add_api_cost(session, day, provider, COST_PER_CALL.get(provider, 0.01))
    if user is not None:
        usage = crud.get_usage(session, user.id, day)
        if provider == "anthropic":
            usage.llm_calls += 1
        elif provider == "elevenlabs":
            usage.tts_calls += 1
        session.commit()


def status(session: Session, day: date | None = None) -> dict:
    day = day or local_today()
    total = crud.total_cost_for_day(session, day)
    cap = get_settings().max_daily_cost_usd
    return {"total_cost_usd": round(total, 2), "cap_usd": cap, "exceeded": total >= cap}
