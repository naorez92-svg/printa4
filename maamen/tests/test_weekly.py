"""Weekly summary: Friday 10:00 for non-shomer, Motzash 21:30 for shomer."""
from datetime import date, datetime, time

from tests.helpers import make_active_user


def _add_week_data(phone):
    from server.db.session import get_session
    from server.db import crud
    from server.db.models import Meal
    session = get_session()
    user = crud.get_user_by_phone(session, phone)
    crud.log_weight(session, user, date(2026, 7, 23), 93.0)
    crud.log_weight(session, user, date(2026, 7, 30), 92.0)
    session.add(Meal(user_id=user.id, date=date(2026, 7, 29), time=time(13, 0),
                     source="text", description="שניצל", calories_est=600, protein_est=35))
    session.commit()
    session.close()


def test_weekly_summary_friday_for_regular_user(app_env, outbox):
    make_active_user("972509999911", shomer=False)
    _add_week_data("972509999911")
    from server.scheduler.jobs import tick
    tick(datetime(2026, 7, 31, 10, 0))  # Friday 10:00

    texts = [m["text"] for m in outbox if m["type"] == "text"]
    summary = next((t for t in texts if "סיכום שבוע" in t), None)
    assert summary is not None
    assert "92.0" in summary and "-1.0" in summary  # weight vs last week
    assert "המיקוד לשבוע הבא" in summary
    assert any(m["type"] == "voice" for m in outbox)  # voice + text


def test_weekly_summary_motzash_for_shomer(app_env, outbox):
    make_active_user("972509999912", shomer=True)
    from server.scheduler.jobs import tick
    tick(datetime(2026, 7, 31, 10, 0))   # Friday — not for shomer users
    assert not [m for m in outbox if "סיכום שבוע" in str(m.get("text", ""))]

    tick(datetime(2026, 8, 1, 21, 30))   # Motzash 21:30
    texts = [m["text"] for m in outbox if m["type"] == "text"]
    assert any("סיכום שבוע" in t for t in texts)
