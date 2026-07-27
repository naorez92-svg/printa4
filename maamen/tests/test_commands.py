"""Fixed text commands (build-plan 5.7): עצור / הסר / משקל / שעה / עזרה."""
import pytest

PHONE = "972506666666"

ONBOARDING = ["היי", "רון", "90 יעד 80", "40, 180, גבר", "משרד",
              "לחץ", "כן", "לא", "06:30", "טקסט"]


def _send(client, text, phone=PHONE):
    resp = client.post("/dev/simulate", json={"phone": phone, "type": "text", "text": text})
    return resp.json()["replies"]


@pytest.fixture()
def active_user(client):
    for a in ONBOARDING:
        _send(client, a)
    return PHONE


def _user(phone=PHONE):
    from server.db.session import get_session
    from server.db import crud
    session = get_session()
    user = crud.get_user_by_phone(session, phone)
    session.close()
    return user


def test_stop_pauses(client, active_user):
    replies = _send(client, "עצור")
    assert _user().status == "paused"
    assert "התחל" in replies[0]


def test_resume_after_pause_zero_guilt(client, active_user):
    _send(client, "עצור")
    replies = _send(client, "חזרתי")
    assert _user().status == "active"
    assert "אפס אשמה" in replies[0]


def test_delete_wipes_personal_data(client, active_user):
    _send(client, "אכלתי סלט")
    replies = _send(client, "הסר")
    assert "נמחקו" in replies[0]

    from server.db.session import get_session
    from server.db import crud
    from server.db.models import Meal, Profile
    from sqlalchemy import select

    session = get_session()
    user = crud.get_user_by_phone(session, PHONE)
    assert user.status == "churned"
    assert user.name is None
    assert session.get(Profile, user.id) is None
    assert not list(session.scalars(select(Meal).where(Meal.user_id == user.id)))
    session.close()


def test_weight_command_logs_weight(client, active_user):
    replies = _send(client, "משקל 92.5")
    assert "92.5" in replies[0]
    from server.db.session import get_session
    from server.db.models import Weight
    from sqlalchemy import select
    session = get_session()
    row = session.scalars(select(Weight)).first()
    assert row.weight_kg == 92.5
    session.close()


def test_hour_command_updates_morning_hour(client, active_user):
    replies = _send(client, "שעה 08:00")
    assert "08:00" in replies[0]
    assert _user().morning_hour.strftime("%H:%M") == "08:00"
