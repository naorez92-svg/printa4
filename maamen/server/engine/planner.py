"""Morning day-planning (build-plan 5.2) — the core feature.

Morning: voice (TTS) + identical text asking about the day. The user's answer
(voice/text) becomes the planning context. No answer within two hours → a
standard day is planned automatically.
"""
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from server import messaging
from server.db import crud
from server.db.models import DailyPlan, User
from server.engine import prompts, state
from server.integrations.anthropic_llm import llm_json

logger = logging.getLogger(__name__)

FALLBACK_AFTER = timedelta(hours=2)


def send_morning(session: Session, user: User, now: datetime) -> None:
    text = prompts.MORNING_MESSAGE.format(name=user.name or "")
    messaging.send_voice_with_text(session, user, text)
    state.set_state(session, user, state.AWAITING_PLAN_CONTEXT, {"sent_at": now.isoformat()})


def _profile_context(session: Session, user: User) -> dict:
    p = crud.get_profile(session, user)
    return {
        "name": user.name,
        "daily_calorie_target": p.daily_calorie_target,
        "protein_target_g": p.protein_target_g,
        "kosher": p.kosher,
        "work_pattern": p.work_pattern,
        "eating_triggers": p.eating_triggers,
    }


def _build_plan(session: Session, user: User, context_note: str, now: datetime) -> dict | None:
    payload = {"profile": _profile_context(session, user), "context": context_note}
    plan = llm_json(session, user, prompts.DAY_PLANNER, json.dumps(payload, ensure_ascii=False))
    if not plan or not isinstance(plan.get("meals"), list) or not plan["meals"]:
        return None
    session.add(DailyPlan(
        user_id=user.id, date=now.date(),
        plan_json=json.dumps(plan, ensure_ascii=False),
        planned_calories=int(plan.get("total_calories") or 0),
        context_note=context_note,
    ))
    session.commit()
    return plan


def _format_plan(plan: dict, friday_shabbat_note: bool) -> str:
    """Max 4 lines per spec: header, two meal lines, footer (+shabbat note on Friday)."""
    meals = plan.get("meals", [])[:4]
    names = [f"{m.get('name')} (~{m.get('calories')})" for m in meals]
    mid = (len(names) + 1) // 2
    lines = [
        prompts.PLAN_HEADER.format(total=plan.get("total_calories", "?")),
        " · ".join(names[:mid]),
    ]
    if names[mid:]:
        lines.append(" · ".join(names[mid:]))
    lines.append(prompts.SHABBAT_FRIDAY_NOTE if friday_shabbat_note else prompts.PLAN_FOOTER)
    return "\n".join(lines)


def _friday_note(session: Session, user: User, now: datetime) -> bool:
    if now.weekday() != 4:  # Friday
        return False
    return crud.get_profile(session, user).shomer_shabbat


def handle_context_reply(session: Session, user: User, text: str, now: datetime) -> list[str]:
    state.clear_state(session, user)
    plan = _build_plan(session, user, text or "יום רגיל", now)
    if plan is None:
        return [prompts.TEMPLATE_FALLBACK_REPLY]
    return [_format_plan(plan, _friday_note(session, user, now))]


def send_fallback_plan(session: Session, user: User, now: datetime) -> None:
    """No answer for two hours → plan a standard day automatically."""
    state.clear_state(session, user)
    plan = _build_plan(session, user, "יום רגיל", now)
    if plan is None:
        return
    text = prompts.FALLBACK_PLAN_PREFIX + "\n" + _format_plan(plan, _friday_note(session, user, now))
    messaging.send_text(session, user, text)


def fallback_due(user: User, now: datetime) -> bool:
    if state.get_state(user) != state.AWAITING_PLAN_CONTEXT:
        return False
    sent_at = state.get_payload(user).get("sent_at")
    if not sent_at:
        return True
    try:
        return now - datetime.fromisoformat(sent_at) >= FALLBACK_AFTER
    except ValueError:
        return True
