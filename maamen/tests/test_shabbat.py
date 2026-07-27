"""Shabbat logic: sunset sanity + proactive messages skipped for shomer users."""
from datetime import date, datetime

from tests.helpers import make_active_user


def test_sunset_sanity_summer_winter(app_env):
    from server.scheduler.shabbat import sunset_local
    july = sunset_local(date(2026, 7, 17))
    assert 19 <= july.hour <= 20
    december = sunset_local(date(2026, 12, 18))
    assert 16 <= december.hour <= 17


def test_quiet_period_windows(app_env):
    from server.scheduler.shabbat import is_quiet_period
    assert is_quiet_period(datetime(2026, 8, 1, 8, 0)) is True      # Shabbat morning
    assert is_quiet_period(datetime(2026, 7, 31, 10, 0)) is False   # Friday morning
    assert is_quiet_period(datetime(2026, 7, 31, 19, 0)) is True    # Friday evening (pre-candles buffer)
    assert is_quiet_period(datetime(2026, 8, 1, 22, 0)) is False    # Motzash, after havdala buffer
    assert is_quiet_period(datetime(2026, 8, 2, 8, 0)) is False     # Sunday


def test_no_proactive_to_shomer_on_shabbat(app_env, outbox):
    from datetime import time
    make_active_user("972508888801", shomer=True, morning=time(8, 0))
    make_active_user("972508888802", shomer=False, morning=time(8, 0))

    from server.scheduler.jobs import tick
    tick(datetime(2026, 8, 1, 8, 0))  # Shabbat 08:00

    phones = {m["phone"] for m in outbox}
    assert "972508888801" not in phones  # shomer — skipped, not queued
    assert "972508888802" in phones      # non-shomer — sent


def test_skipped_morning_not_sent_after_shabbat(app_env, outbox):
    from datetime import time
    make_active_user("972508888803", shomer=True, morning=time(8, 0))
    from server.scheduler.jobs import tick
    tick(datetime(2026, 8, 1, 8, 0))    # during Shabbat — skipped
    tick(datetime(2026, 8, 1, 22, 0))   # after Shabbat — not that user's morning minute
    assert not [m for m in outbox if m["phone"] == "972508888803" and "בוקר טוב" in str(m.get("text", ""))]
