"""Accountability chain: 24h / 48h / 96h nudges + paused weekly ping."""
from datetime import datetime, timedelta

from tests.helpers import make_active_user

PHONE = "972509999901"
NOW = datetime(2026, 7, 28, 12, 34)  # Tuesday, not a morning/evening minute


def _set_last_inbound(phone, dt):
    from server.db.session import get_session
    from server.db import crud
    session = get_session()
    user = crud.get_user_by_phone(session, phone)
    user.last_inbound_at = dt
    session.commit()
    session.close()


def _user(phone=PHONE):
    from server.db.session import get_session
    from server.db import crud
    session = get_session()
    user = crud.get_user_by_phone(session, phone)
    session.close()
    return user


def test_24h_gentle_nudge_once(app_env, outbox):
    make_active_user(PHONE)
    _set_last_inbound(PHONE, NOW - timedelta(hours=25))
    from server.scheduler.jobs import tick

    tick(NOW)
    texts = [m["text"] for m in outbox if m["type"] == "text"]
    assert any("לא שמעתי ממך היום" in t for t in texts)

    outbox.clear()
    tick(NOW + timedelta(minutes=1))  # same level — no duplicate
    assert not outbox


def test_48h_personal_nudge(app_env, outbox):
    make_active_user(PHONE, triggers="ערב מול הטלוויזיה")
    _set_last_inbound(PHONE, NOW - timedelta(hours=49))
    from server.scheduler.jobs import tick
    tick(NOW)
    texts = [m["text"] for m in outbox if m["type"] == "text"]
    assert any("ערב מול הטלוויזיה" in t for t in texts)  # references the profile


def test_96h_pauses_user(app_env, outbox):
    make_active_user(PHONE)
    _set_last_inbound(PHONE, NOW - timedelta(hours=97))
    from server.scheduler.jobs import tick
    tick(NOW)
    texts = [m["text"] for m in outbox if m["type"] == "text"]
    assert any("אני פה כשתחזור" in t for t in texts)
    assert _user().status == "paused"

    # paused users: no more proactive except the weekly ping
    outbox.clear()
    tick(NOW + timedelta(minutes=1))
    assert not outbox
    tick(datetime(2026, 7, 31, 10, 0))  # Friday 10:00 — weekly ping
    assert any("עדיין פה" in m["text"] for m in outbox if m["type"] == "text")
