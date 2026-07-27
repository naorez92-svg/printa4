"""Local time helpers — hard-wired to Asia/Jerusalem per the build plan."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Jerusalem")


def local_now() -> datetime:
    """Naive local (Israel) time — the app's single clock."""
    return datetime.now(TZ).replace(tzinfo=None)


def local_today() -> date:
    return local_now().date()
