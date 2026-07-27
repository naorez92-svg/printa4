"""Proactive scheduling: a minute tick drives all outbound flows.

The tick is a pure function of `now`, so every flow is unit-testable; the
APScheduler wiring only calls tick() each minute and backs up the DB daily.
Timezone is hard-wired to Asia/Jerusalem.
"""
import logging
import shutil
from datetime import datetime, time as dtime

from sqlalchemy import select

from server.config import get_settings
from server.db import crud
from server.db.models import User
from server.db.session import get_session
from server import messaging
from server.engine import checkin, planner, prompts, weekly
from server.scheduler import shabbat
from server.utils.timeutil import TZ, local_now

logger = logging.getLogger(__name__)

WEEKLY_SHOMER = (5, dtime(21, 30))      # Saturday night (motzash)
WEEKLY_REGULAR = (4, dtime(10, 0))      # Friday morning
PAUSED_PING = (4, dtime(10, 0))         # weekly ping for paused users

BACKUPS_TO_KEEP = 14


def _matches(now: datetime, weekday: int, at: dtime) -> bool:
    return now.weekday() == weekday and now.hour == at.hour and now.minute == at.minute


def _matches_user_time(now: datetime, at: dtime) -> bool:
    return now.hour == at.hour and now.minute == at.minute


def tick(now: datetime | None = None) -> None:
    now = now or local_now()
    session = get_session()
    try:
        users = list(session.scalars(select(User).where(User.status.in_(("active", "paused")))))
        quiet_now = shabbat.is_quiet_period(now)

        for user in users:
            try:
                profile = crud.get_profile(session, user)
                if profile.shomer_shabbat and quiet_now:
                    continue  # skipped, not queued

                if user.status == "paused":
                    if _matches(now, *PAUSED_PING):
                        messaging.send_text(session, user, prompts.PAUSED_WEEKLY_PING)
                    continue

                if user.medical_flag:
                    continue  # support-only mode: no proactive tracking flows

                if _matches_user_time(now, user.morning_hour):
                    planner.send_morning(session, user, now)
                elif planner.fallback_due(user, now):
                    planner.send_fallback_plan(session, user, now)

                if _matches_user_time(now, user.evening_hour):
                    checkin.send_evening(session, user, now)

                weekly_at = WEEKLY_SHOMER if profile.shomer_shabbat else WEEKLY_REGULAR
                if _matches(now, *weekly_at):
                    weekly.send_weekly_summary(session, user, now)

                checkin.run_nudges(session, user, now)
            except Exception:
                logger.exception("tick failed for user %s", user.id)
    finally:
        session.close()


def backup_db() -> None:
    """Daily SQLite backup into data/backups/, keeping the last 14."""
    settings = get_settings()
    src = settings.database_path
    if not src.exists():
        return
    backups_dir = src.parent / "backups"
    backups_dir.mkdir(parents=True, exist_ok=True)
    dest = backups_dir / f"maamen-{local_now():%Y%m%d}.db"
    shutil.copy2(src, dest)
    old = sorted(backups_dir.glob("maamen-*.db"))
    for stale in old[:-BACKUPS_TO_KEEP]:
        stale.unlink(missing_ok=True)


_scheduler = None


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    from apscheduler.schedulers.background import BackgroundScheduler

    _scheduler = BackgroundScheduler(timezone=TZ)
    _scheduler.add_job(tick, "cron", minute="*", id="tick")
    _scheduler.add_job(backup_db, "cron", hour=3, minute=30, id="backup")
    _scheduler.start()
    logger.info("scheduler started (Asia/Jerusalem)")


def scheduler_status() -> dict:
    running = _scheduler is not None and getattr(_scheduler, "running", False)
    return {"running": running, "is_shabbat_now": shabbat.is_quiet_period(local_now())}
