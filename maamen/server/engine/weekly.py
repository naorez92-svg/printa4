"""Weekly summary (build-plan 5.6): voice + text, always positive."""
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from server import messaging
from server.db import crud
from server.db.models import DailyPlan, Meal, User
from server.engine import prompts
from server.integrations.anthropic_llm import llm_json

logger = logging.getLogger(__name__)


def _week_stats(session: Session, user: User, now: datetime) -> dict:
    today = now.date()
    week_ago = today - timedelta(days=7)

    current = crud.latest_weight_before(session, user, today)
    previous = crud.latest_weight_before(session, user, week_ago)

    daily_totals = session.execute(
        select(Meal.date, func.sum(Meal.calories_est))
        .where(Meal.user_id == user.id, Meal.date > week_ago, Meal.date <= today)
        .group_by(Meal.date)
    ).all()
    avg_calories = int(sum(t or 0 for _, t in daily_totals) / len(daily_totals)) if daily_totals else 0

    plan_days = session.scalar(
        select(func.count(func.distinct(DailyPlan.date)))
        .where(DailyPlan.user_id == user.id, DailyPlan.date > week_ago, DailyPlan.date <= today)
    ) or 0

    flags = session.execute(
        select(Meal.emotional_flag, func.count(Meal.id))
        .where(Meal.user_id == user.id, Meal.date > week_ago,
               Meal.emotional_flag.is_not(None))
        .group_by(Meal.emotional_flag)
    ).all()

    return {
        "current_weight": current.weight_kg if current else None,
        "previous_weight": previous.weight_kg if (previous and current and previous.id != current.id) else None,
        "avg_calories": avg_calories,
        "plan_days": plan_days,
        "emotional_flags": {f: c for f, c in flags},
    }


def _weight_line(stats: dict) -> str:
    current, previous = stats["current_weight"], stats["previous_weight"]
    if current is None:
        return prompts.WEIGHT_LINE_NONE
    if previous is None:
        return prompts.WEIGHT_LINE_SINGLE.format(current=current)
    diff = round(current - previous, 1)
    change = f"{diff:+.1f}"
    praise = "כל הכבוד, ממשיכים!" if diff <= 0 else "שבוע חדש, דף חדש"
    return prompts.WEIGHT_LINE_CHANGE.format(current=current, change=change, praise=praise)


def send_weekly_summary(session: Session, user: User, now: datetime) -> None:
    profile = crud.get_profile(session, user)
    stats = _week_stats(session, user, now)

    insight = llm_json(
        session, user, prompts.WEEKLY_INSIGHT,
        json.dumps(stats, ensure_ascii=False, default=str),
    ) or {}

    text = prompts.WEEKLY_SUMMARY.format(
        weight_line=_weight_line(stats),
        avg_calories=stats["avg_calories"],
        target=profile.daily_calorie_target or "?",
        plan_days=stats["plan_days"],
        insight=insight.get("insight_he") or "שבוע של עקביות — זה מה שסופר",
        focus=insight.get("focus_he") or "ממשיכים עם תכנון בוקר כל יום",
    )
    messaging.send_voice_with_text(session, user, text)
