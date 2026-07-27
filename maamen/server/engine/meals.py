"""Meal pipelines: photo / voice / text → analysis → log → feedback.

Build-plan 5.3: high confidence logs immediately; medium/low asks ONE
clarifying question; overage gets one constructive sentence; off-plan meals
between meal windows get the emotional-hunger question.
"""
import json
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from server.db import crud
from server.db.models import Meal, User
from server.engine import prompts, state
from server.integrations.anthropic_llm import image_content, llm_json

logger = logging.getLogger(__name__)

# typical Israeli meal windows (hours); anything else counts as "between meals"
MEAL_WINDOWS = ((6, 10), (12, 15), (18, 21))

EMOTIONAL_KEYWORDS = {
    "hungry": ("רעב", "רעבה", "אמיתי"),
    "bored": ("שעמום", "משעמם"),
    "stress": ("לחץ", "סטרס", "עצבים", "לחוץ"),
    "social": ("חברתי", "אירוע", "חברים", "משפחה"),
}


def _analyze(session: Session, user: User, content) -> dict | None:
    return llm_json(session, user, prompts.MEAL_VISION, content)


def _is_between_meals(now: datetime) -> bool:
    return not any(start <= now.hour < end for start, end in MEAL_WINDOWS)


def _matches_plan(session: Session, user: User, description: str, now: datetime) -> bool:
    plan = crud.plan_for_day(session, user, now.date())
    if plan is None:
        return False
    try:
        planned = json.loads(plan.plan_json).get("meals", [])
    except (json.JSONDecodeError, AttributeError):
        return False
    desc_words = {w for w in description.split() if len(w) >= 3}
    for meal in planned:
        name_words = {w for w in str(meal.get("name", "")).split() if len(w) >= 3}
        if desc_words & name_words:
            return True
    return False


def _log_meal(
    session: Session, user: User, analysis: dict, source: str, now: datetime,
    image_ref: str | None = None,
) -> tuple[Meal, list[str]]:
    profile = crud.get_profile(session, user)
    matched = _matches_plan(session, user, analysis.get("description_he", ""), now)
    meal = Meal(
        user_id=user.id, date=now.date(), time=now.time(), source=source,
        description=analysis.get("description_he", ""),
        calories_est=int(analysis.get("calories") or 0),
        protein_est=int(analysis.get("protein_g") or 0),
        confidence=analysis.get("confidence", "medium"),
        matched_plan=matched, image_ref=image_ref,
    )
    session.add(meal)
    session.commit()

    total = crud.calories_for_day(session, user, now.date())
    target = profile.daily_calorie_target or 0
    replies = [prompts.MEAL_LOGGED_REPLY.format(
        desc=meal.description, cal=meal.calories_est, total=total, target=target or "?",
    )]
    if target and total > target:
        replies.append(prompts.OVER_TARGET_REPLY.format(over=total - target))

    if not matched and _is_between_meals(now):
        state.set_state(session, user, state.AWAITING_EMOTIONAL_ANSWER, {"meal_id": meal.id})
        replies.append(prompts.EMOTIONAL_QUESTION)

    return meal, replies


def _dispatch_analysis(
    session: Session, user: User, analysis: dict | None, source: str, now: datetime,
    original_text: str | None = None, image_ref: str | None = None,
) -> list[str]:
    if analysis is None:
        return [prompts.TEMPLATE_FALLBACK_REPLY]

    if not analysis.get("description_he") or analysis.get("calories") is None:
        # not food → free-form coach chat (text/voice only)
        if original_text:
            from server.engine.router import coach_chat
            return coach_chat(session, user, original_text)
        return [prompts.NOT_FOOD_FALLBACK]

    confidence = analysis.get("confidence", "medium")
    question = analysis.get("one_clarifying_question_or_null")
    if confidence in ("medium", "low") and question:
        state.set_state(session, user, state.AWAITING_MEAL_CLARIFICATION,
                        {"analysis": analysis, "source": source, "image_ref": image_ref})
        return [prompts.MEAL_CLARIFY_PREFIX.format(question=question)]

    _meal, replies = _log_meal(session, user, analysis, source, now, image_ref)
    return replies


def handle_photo(session: Session, user: User, image_b64: str, now: datetime) -> list[str]:
    analysis = _analyze(session, user, image_content(image_b64, prompts.MEAL_VISION))
    return _dispatch_analysis(session, user, analysis, "photo", now, image_ref="inbound-photo")


def handle_free_text(
    session: Session, user: User, text: str, now: datetime, source: str = "text",
) -> list[str]:
    analysis = _analyze(session, user, text)
    return _dispatch_analysis(session, user, analysis, source, now, original_text=text)


def handle_clarification(session: Session, user: User, text: str, now: datetime) -> list[str]:
    payload = state.get_payload(user)
    analysis = payload.get("analysis") or {}
    source = payload.get("source", "text")
    image_ref = payload.get("image_ref")
    state.clear_state(session, user)

    refined = _analyze(
        session, user,
        f"{analysis.get('description_he', '')} — הבהרה מהמשתמש: {text}",
    )
    if refined and refined.get("calories") is not None and refined.get("description_he"):
        refined["confidence"] = "high"
        analysis = refined
    if analysis.get("calories") is None:
        return [prompts.TEMPLATE_FALLBACK_REPLY]
    _meal, replies = _log_meal(session, user, analysis, source, now, image_ref)
    return replies


def handle_emotional_answer(session: Session, user: User, text: str, now: datetime) -> list[str]:
    payload = state.get_payload(user)
    state.clear_state(session, user)
    meal = session.get(Meal, payload.get("meal_id", -1))
    if meal is None:
        return [prompts.EMOTIONAL_ACK]

    flag = None
    for value, keywords in EMOTIONAL_KEYWORDS.items():
        if any(k in text for k in keywords):
            flag = value
            break
    meal.emotional_flag = flag or "hungry"
    session.commit()

    if meal.emotional_flag in ("stress", "bored"):
        count = crud.emotional_flags_this_week(session, user, now.date(), ("stress", "bored"))
        if count >= 2:
            return [prompts.TECHNIQUE_SUGGESTION]
    return [prompts.EMOTIONAL_ACK]
