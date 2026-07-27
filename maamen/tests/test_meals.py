"""Stage 3 acceptance: meal pipelines — photo/voice/text, 3 confidence levels,
overage, emotional flag, whisper fallback."""
import pytest

PHONE = "972505555555"

ONBOARDING = ["היי", "דני", "95 יעד 85", "35, 178, גבר", "יושב מול מחשב",
              "ערב", "לא", "לא", "07:30", "טקסט"]


def _send(client, text=None, mtype="text", phone=PHONE):
    body = {"phone": phone, "type": mtype}
    if text is not None:
        body["text"] = text
    resp = client.post("/dev/simulate", json=body)
    assert resp.status_code == 200
    return resp.json()["replies"]


@pytest.fixture()
def active_user(client):
    for answer in ONBOARDING:
        _send(client, answer)
    return PHONE


def _meals(phone=PHONE):
    from server.db.session import get_session
    from server.db import crud
    from server.db.models import Meal
    from sqlalchemy import select

    session = get_session()
    user = crud.get_user_by_phone(session, phone)
    rows = list(session.scalars(select(Meal).where(Meal.user_id == user.id)))
    session.close()
    return rows


def test_text_meal_high_confidence_logged(client, active_user):
    replies = _send(client, "אכלתי סלט עם טונה")
    assert "רשמתי" in replies[0]
    rows = _meals()
    assert len(rows) == 1
    assert rows[0].calories_est == 320
    assert rows[0].confidence == "high"
    assert rows[0].source == "text"


def test_medium_confidence_asks_one_question_then_logs(client, active_user):
    replies = _send(client, "אכלתי פיצה")
    assert "?" in replies[0]  # one clarifying question
    assert not _meals()  # not logged yet
    replies = _send(client, "אכלתי פיצה 2 משולשים")  # answer re-analyzed
    assert "רשמתי" in replies[0]
    assert len(_meals()) == 1


def test_low_confidence_asks_question(client, active_user):
    replies = _send(client, "אכלתי מרק")
    assert "?" in replies[0]


def test_over_target_gets_constructive_sentence(client, active_user, monkeypatch):
    from server.engine import meals as meals_mod
    monkeypatch.setattr(meals_mod, "_is_between_meals", lambda now: False)
    for _ in range(4):
        _send(client, "אכלתי בורגר")  # 1200 kcal each, target ~2300
    replies = _send(client, "אכלתי בורגר")
    joined = " ".join(replies)
    assert "עברת" in joined and "מחר" in joined


def test_voice_meal_via_whisper_mock(client, active_user):
    replies = _send(client, mtype="voice")
    assert "רשמתי" in replies[0]
    rows = _meals()
    assert rows[0].source == "voice"
    assert "שניצל" in rows[0].description


def test_voice_fallback_when_transcription_fails(client, active_user, monkeypatch):
    from server.engine import router
    monkeypatch.setattr(router, "transcribe", lambda *a, **k: None)
    replies = _send(client, mtype="voice")
    assert "לא הצלחתי לשמוע" in replies[0]


def test_whisper_returns_none_without_key(app_env, monkeypatch):
    monkeypatch.setenv("MOCK_MODE", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    from server.config import reset_settings
    reset_settings()
    from server.integrations.whisper import transcribe
    assert transcribe(None, None, b"audio") is None


def test_emotional_flag_and_technique(client, active_user, monkeypatch):
    from server.engine import meals as meals_mod
    monkeypatch.setattr(meals_mod, "_is_between_meals", lambda now: True)

    _send(client, "אכלתי סלט קטן")          # off-plan (no plan) + between meals
    replies = _send(client, "בעיקר לחץ")     # emotional answer #1
    rows = _meals()
    assert rows[0].emotional_flag == "stress"

    _send(client, "אכלתי סלט שוב")
    replies = _send(client, "שעמום")          # emotional answer #2 same week
    assert "10 דקות" in replies[0] or "מים" in replies[0]  # technique suggested


def test_medical_content_sets_flag_and_refers(client, active_user):
    replies = _send(client, "התחלתי לקחת תרופות חדשות")
    assert "רופא" in replies[0]
    from server.db.session import get_session
    from server.db import crud
    session = get_session()
    user = crud.get_user_by_phone(session, PHONE)
    assert user.medical_flag is True
    session.close()
    # afterwards: support-only, meals are not tracked
    _send(client, "אכלתי סלט")
    assert not _meals()
