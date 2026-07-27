"""Cost guard: per-user LLM cap, TTS cap, global daily ceiling → template mode."""
from datetime import datetime

from tests.helpers import make_active_user

NOW = datetime(2026, 7, 28, 13, 0)


def test_user_llm_cap_blocks_llm(app_env, monkeypatch):
    monkeypatch.setenv("MAX_LLM_CALLS_PER_USER_PER_DAY", "2")
    from server.config import reset_settings
    reset_settings()

    make_active_user("972501111222")
    from server.db.session import get_session
    from server.db import crud
    from server.integrations.anthropic_llm import llm_text

    session = get_session()
    user = crud.get_user_by_phone(session, "972501111222")
    assert llm_text(session, user, "test", "שלום") is not None
    assert llm_text(session, user, "test", "שלום") is not None
    assert llm_text(session, user, "test", "שלום") is None  # over the cap
    session.close()


def test_over_cap_user_still_gets_template_reply(client, monkeypatch):
    monkeypatch.setenv("MAX_LLM_CALLS_PER_USER_PER_DAY", "0")
    from server.config import reset_settings
    reset_settings()

    make_active_user("972502222333")
    resp = client.post("/dev/simulate", json={"phone": "972502222333", "type": "text", "text": "אכלתי סלט"})
    replies = resp.json()["replies"]
    assert replies == ["קיבלתי 👍"]  # template mode, bot keeps answering


def test_global_cost_cap_blocks_all_providers(app_env):
    make_active_user("972503333444")
    from server.db.session import get_session
    from server.db import crud
    from server.utils import cost_guard

    session = get_session()
    user = crud.get_user_by_phone(session, "972503333444")
    for _ in range(200):  # burn past the $15 daily ceiling
        cost_guard.note_call(session, user, "elevenlabs", NOW.date())
    assert cost_guard.global_cost_exceeded(session, NOW.date()) is True
    assert cost_guard.allow_llm(session, user, NOW.date()) is False
    assert cost_guard.allow_tts(session, user, NOW.date()) is False
    assert cost_guard.status(session, NOW.date())["exceeded"] is True  # admin red banner
    session.close()


def test_tts_daily_cap(app_env):
    make_active_user("972504444555")
    from server.db.session import get_session
    from server.db import crud
    from server.integrations.tts import synthesize

    session = get_session()
    user = crud.get_user_by_phone(session, "972504444555")
    for _ in range(3):
        assert synthesize(session, user, "בוקר טוב") is not None
    assert synthesize(session, user, "בוקר טוב") is None  # 4th blocked → text only
    session.close()
