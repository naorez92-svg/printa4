"""Evening check-in + accountability nudges (build-plan 5.4, 5.5)."""
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from server import messaging
from server.db import crud
from server.db.models import User
from server.engine import prompts

logger = logging.getLogger(__name__)

WEIGH_DAY = 6  # Sunday (python weekday) — fixed weekly weigh-in request

# nudge levels: hours-without-inbound threshold → level stored in missed_days_streak
NUDGE_LEVELS = ((96, 4), (48, 2), (24, 1))


def send_evening(session: Session, user: User, now: datetime) -> None:
    profile = crud.get_profile(session, user)
    total = crud.calories_for_day(session, user, now.date())
    text = prompts.EVENING_CHECKIN.format(
        total=total, target=profile.daily_calorie_target or "?")
    messaging.send_text(session, user, text)
    if now.weekday() == WEIGH_DAY:
        messaging.send_text(session, user, prompts.WEIGH_REQUEST)


def _nudge_level(user: User, now: datetime) -> int:
    if user.last_inbound_at is None:
        return 0
    hours = (now - user.last_inbound_at).total_seconds() / 3600
    for threshold, level in NUDGE_LEVELS:
        if hours >= threshold:
            return level
    return 0


def run_nudges(session: Session, user: User, now: datetime) -> None:
    """Send at most one nudge per level crossing; level 4 pauses the user."""
    level = _nudge_level(user, now)
    if level <= user.missed_days_streak:
        return

    if level == 1:
        messaging.send_text(session, user, prompts.NUDGE_24)
    elif level == 2:
        profile = crud.get_profile(session, user)
        personal = profile.eating_triggers or profile.work_pattern
        if personal:
            messaging.send_text(session, user, prompts.NUDGE_48_PERSONAL.format(personal=personal))
        else:
            messaging.send_text(session, user, prompts.NUDGE_48_GENERIC)
    elif level == 4:
        messaging.send_text(session, user, prompts.NUDGE_96_PAUSE)
        user.status = "paused"

    user.missed_days_streak = level
    session.commit()
