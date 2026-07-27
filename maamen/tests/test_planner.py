"""Stage 4 acceptance: morning planning + 2h fallback + evening check-in."""
from datetime import datetime

from tests.helpers import make_active_user

PHONE = "972507777777"
TUESDAY_7AM = datetime(2026, 7, 28, 7, 0)


def test_morning_message_voice_and_text(app_env, outbox):
    make_active_user(PHONE)
    from server.scheduler.jobs import tick
    tick(TUESDAY_7AM)

    types = [m["type"] for m in outbox]
    assert "voice" in types and "text" in types  # TTS + identical text
    text_msg = next(m for m in outbox if m["type"] == "text")
    assert "בוקר טוב" in text_msg["text"]

    from server.db.session import get_session
    from server.db import crud
    session = get_session()
    user = crud.get_user_by_phone(session, PHONE)
    assert user.conversation_state == "awaiting_plan_context"
    session.close()


def test_context_reply_builds_plan_max_4_lines(app_env, outbox):
    make_active_user(PHONE)
    from server.scheduler.jobs import tick
    from server.engine import router
    tick(TUESDAY_7AM)
    outbox.clear()

    replies = router.process_incoming(PHONE, "text", text="יום רגיל בעבודה",
                                      now=TUESDAY_7AM.replace(minute=5))
    assert replies
    assert len(replies[0].split("\n")) <= 4

    from server.db.session import get_session
    from server.db import crud
    from server.db.models import DailyPlan
    from sqlalchemy import select
    session = get_session()
    plan = session.scalars(select(DailyPlan)).first()
    assert plan is not None
    assert plan.planned_calories == 1500
    assert plan.context_note == "יום רגיל בעבודה"
    user = crud.get_user_by_phone(session, PHONE)
    assert user.conversation_state is None
    session.close()


def test_fallback_plan_after_two_hours(app_env, outbox):
    make_active_user(PHONE)
    from server.scheduler.jobs import tick
    tick(TUESDAY_7AM)
    outbox.clear()

    tick(TUESDAY_7AM.replace(hour=9, minute=1))  # 2h+ later, no answer

    texts = [m["text"] for m in outbox if m["type"] == "text"]
    assert any("סטנדרטי" in t for t in texts)

    from server.db.session import get_session
    from server.db import crud
    from server.db.models import DailyPlan
    from sqlalchemy import select
    session = get_session()
    assert session.scalars(select(DailyPlan)).first() is not None
    user = crud.get_user_by_phone(session, PHONE)
    assert user.conversation_state is None
    session.close()


def test_evening_checkin_and_sunday_weigh_request(app_env, outbox):
    make_active_user(PHONE)
    from server.scheduler.jobs import tick

    tick(datetime(2026, 7, 28, 20, 30))  # Tuesday evening
    texts = [m["text"] for m in outbox if m["type"] == "text"]
    assert any("איך היה היום" in t for t in texts)
    assert not any("המשקל" in t for t in texts)

    outbox.clear()
    tick(datetime(2026, 8, 2, 20, 30))  # Sunday evening → weigh-in request
    texts = [m["text"] for m in outbox if m["type"] == "text"]
    assert any("המשקל מחר בבוקר" in t for t in texts)
