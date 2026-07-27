"""Stage 2 acceptance: full onboarding → active, profile + targets saved."""

PHONE = "972503333333"

ANSWERS = [
    "נאור",                      # name
    "95 יעד 85",                 # current / goal weight
    "35, 178, גבר",              # age, height, gender
    "יושב מול מחשב במשרד",       # work pattern
    "ערב מול הטלוויזיה",         # eating triggers
    "כן",                        # kosher
    "כן",                        # shomer shabbat
    "07:00",                     # morning hour
    "קול",                       # voice preference
]


def _send(client, text, phone=PHONE):
    resp = client.post("/dev/simulate", json={"phone": phone, "type": "text", "text": text})
    assert resp.status_code == 200
    return resp.json()["replies"]


def test_full_onboarding_to_active(client):
    replies = _send(client, "היי")
    assert "איך קוראים לך" in replies[0]

    for answer in ANSWERS:
        replies = _send(client, answer)
    # final summary message
    assert "85" in replies[0] and "קק\"ל" in replies[0]

    from server.db.session import get_session
    from server.db import crud

    session = get_session()
    user = crud.get_user_by_phone(session, PHONE)
    assert user.status == "active"
    assert user.name == "נאור"
    assert user.morning_hour.strftime("%H:%M") == "07:00"
    assert user.voice_enabled is True

    profile = crud.get_profile(session, user)
    assert profile.start_weight_kg == 95
    assert profile.goal_weight_kg == 85
    assert profile.age == 35 and profile.height_cm == 178 and profile.gender == "male"
    assert profile.kosher is True and profile.shomer_shabbat is True
    assert profile.daily_calorie_target and profile.daily_calorie_target >= 1500
    assert profile.protein_target_g == 136  # 1.6 × 85
    session.close()


def test_onboarding_reasks_on_bad_answer(client):
    _send(client, "היי", phone="972504444444")
    _send(client, "דני", phone="972504444444")
    replies = _send(client, "אין לי מושג", phone="972504444444")  # bad weight answer
    assert "לא הצלחתי להבין" in replies[0]
