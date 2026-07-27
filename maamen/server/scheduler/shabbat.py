"""Shabbat & Jewish holiday quiet windows (build-plan section 6).

Sunset: internal NOAA approximation for central Israel (31.9N/34.8E) — see
DECISIONS.md. Holidays: `hdate` if importable, else `pyluach` (major, non-working
festivals only). Quiet window for shomer-shabbat users: from one hour before
candle lighting until 30 minutes after havdala. Jobs inside the window are
skipped, not queued.
"""
import math
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

LAT, LON = 31.9, 34.8
TZ = ZoneInfo("Asia/Jerusalem")
CANDLE_BEFORE_SUNSET_MIN = 20
HAVDALA_AFTER_SUNSET_MIN = 42
PRE_BUFFER_MIN = 60   # block starts an hour before candle lighting
POST_BUFFER_MIN = 30  # ...and ends half an hour after havdala

try:  # pragma: no cover - environment dependent
    from pyluach import dates as _pyluach_dates
except ImportError:  # pragma: no cover
    _pyluach_dates = None


def sunset_local(d: date) -> datetime:
    """NOAA sunset approximation → naive Asia/Jerusalem datetime (handles DST)."""
    zenith = 90.833
    n = d.timetuple().tm_yday
    lng_hour = LON / 15
    t = n + ((18 - lng_hour) / 24)
    m = (0.9856 * t) - 3.289
    l = (m + (1.916 * math.sin(math.radians(m))) + (0.020 * math.sin(math.radians(2 * m))) + 282.634) % 360
    ra = math.degrees(math.atan(0.91764 * math.tan(math.radians(l)))) % 360
    ra += (math.floor(l / 90) * 90) - (math.floor(ra / 90) * 90)
    ra /= 15
    sin_dec = 0.39782 * math.sin(math.radians(l))
    cos_dec = math.cos(math.asin(sin_dec))
    cos_h = (math.cos(math.radians(zenith)) - (sin_dec * math.sin(math.radians(LAT)))) / (
        cos_dec * math.cos(math.radians(LAT)))
    cos_h = max(-1.0, min(1.0, cos_h))
    h = math.degrees(math.acos(cos_h)) / 15
    ut = (h + ra - (0.06571 * t) - 6.622 - lng_hour) % 24
    utc_dt = datetime(d.year, d.month, d.day, tzinfo=timezone.utc) + timedelta(hours=ut)
    return utc_dt.astimezone(TZ).replace(tzinfo=None)


def is_rest_day(d: date) -> bool:
    """Saturday or a major (non-working) Jewish festival, Israel rules."""
    if d.weekday() == 5:  # Saturday
        return True
    if _pyluach_dates is not None:
        heb = _pyluach_dates.HebrewDate.from_pydate(d)
        festival = heb.festival(israel=True, include_working_days=False)
        return festival is not None
    return False


def rest_entry(d: date) -> datetime:
    """Start of quiet buffer for a rest day d (the evening before)."""
    eve = d - timedelta(days=1)
    candle = sunset_local(eve) - timedelta(minutes=CANDLE_BEFORE_SUNSET_MIN)
    return candle - timedelta(minutes=PRE_BUFFER_MIN)


def rest_exit(d: date) -> datetime:
    """End of quiet buffer when rest day d is the last consecutive rest day."""
    havdala = sunset_local(d) + timedelta(minutes=HAVDALA_AFTER_SUNSET_MIN)
    return havdala + timedelta(minutes=POST_BUFFER_MIN)


def is_quiet_period(now: datetime) -> bool:
    """True when proactive messages must not be sent (shomer-shabbat users)."""
    today = now.date()
    if is_rest_day(today):
        if is_rest_day(today + timedelta(days=1)):
            return True  # multi-day rest (e.g. chag + shabbat)
        return now < rest_exit(today)
    if is_rest_day(today + timedelta(days=1)):
        return now >= rest_entry(today + timedelta(days=1))
    return False
