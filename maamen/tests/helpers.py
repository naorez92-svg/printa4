"""Test helpers: create active users directly in the DB."""
from datetime import time

from server.db.session import get_session
from server.db.models import Profile, User


def make_active_user(
    phone: str, name: str = "דני", shomer: bool = False, voice: bool = True,
    morning: time = time(7, 0), evening: time = time(20, 30),
    calorie_target: int = 2000, triggers: str | None = "ערב מול הטלוויזיה",
) -> int:
    session = get_session()
    user = User(
        phone=phone, name=name, status="active", morning_hour=morning,
        evening_hour=evening, voice_enabled=voice,
    )
    session.add(user)
    session.commit()
    session.add(Profile(
        user_id=user.id, gender="male", age=35, height_cm=178,
        start_weight_kg=95, goal_weight_kg=85, activity_level="light",
        kosher=False, shomer_shabbat=shomer, eating_triggers=triggers,
        daily_calorie_target=calorie_target, protein_target_g=136,
    ))
    session.commit()
    user_id = user.id
    session.close()
    return user_id
