"""Onboarding conversation: 9 questions, one at a time, no forms.

Answers land in profiles; at the end targets are computed, the coach sends a
summary + method explanation, and the user becomes active.
"""
import re
from datetime import time

from sqlalchemy.orm import Session

from server.db import crud
from server.db.models import User
from server.engine import prompts, state, targets
from server.utils import hebrew

STEP_ORDER = ["name", "goal", "body", "work", "triggers", "kosher", "shabbat", "morning", "voice"]


def start(session: Session, user: User) -> list[str]:
    user.status = "onboarding"
    state.set_state(session, user, state.ONBOARDING_PREFIX + "name")
    return [prompts.ONBOARDING_WELCOME]


def _question(user: User, step: str) -> str:
    return prompts.ONBOARDING_QUESTIONS[step].format(name=user.name or "")


def _parse_body(text: str) -> tuple[int, int, str] | None:
    nums = [float(n.replace(",", ".")) for n in re.findall(r"\d+(?:[.,]\d+)?", text)]
    gender = None
    t = text.lower()
    if any(w in t for w in ("גבר", "זכר", "בן ")):
        gender = "male"
    if any(w in t for w in ("אישה", "נקבה", "בת ")):
        gender = "female"
    age = next((int(n) for n in nums if 10 <= n < 100), None)
    height = next((int(n) for n in nums if 120 <= n <= 230), None)
    if age is None or height is None or gender is None:
        return None
    return age, height, gender


def handle(session: Session, user: User, text: str) -> list[str]:
    current = (state.get_state(user) or "").removeprefix(state.ONBOARDING_PREFIX)
    if current not in STEP_ORDER:
        return start(session, user)

    text = hebrew.normalize(text)
    profile = crud.get_profile(session, user)

    if current == "name":
        if len(text) < 2:
            return [prompts.ONBOARDING_RETRY.format(question=prompts.ONBOARDING_WELCOME)]
        user.name = text.split()[0][:40]

    elif current == "goal":
        nums = [float(n.replace(",", ".")) for n in re.findall(r"\d+(?:[.,]\d+)?", text)]
        weights = [n for n in nums if 35 <= n <= 300]
        if len(weights) < 2:
            return [prompts.ONBOARDING_RETRY.format(question=_question(user, current))]
        profile.start_weight_kg, profile.goal_weight_kg = weights[0], weights[1]

    elif current == "body":
        parsed = _parse_body(text)
        if parsed is None:
            return [prompts.ONBOARDING_RETRY.format(question=_question(user, current))]
        profile.age, profile.height_cm, profile.gender = parsed

    elif current == "work":
        profile.work_pattern = text
        t = text.lower()
        if any(w in t for w in ("פיזי", "רגליים", "בתנועה", "הליכה")):
            profile.activity_level = "moderate"
        elif any(w in t for w in ("יושב", "משרד", "מחשב")):
            profile.activity_level = "sedentary"
        else:
            profile.activity_level = "light"

    elif current == "triggers":
        profile.eating_triggers = text

    elif current == "kosher":
        answer = hebrew.parse_yes_no(text)
        if answer is None:
            return [prompts.ONBOARDING_RETRY.format(question=_question(user, current))]
        profile.kosher = answer

    elif current == "shabbat":
        answer = hebrew.parse_yes_no(text)
        if answer is None:
            return [prompts.ONBOARDING_RETRY.format(question=_question(user, current))]
        profile.shomer_shabbat = answer

    elif current == "morning":
        parsed = hebrew.extract_time(text)
        if parsed is None:
            return [prompts.ONBOARDING_RETRY.format(question=_question(user, current))]
        user.morning_hour = time(parsed[0], parsed[1])

    elif current == "voice":
        t = text.lower()
        user.voice_enabled = not ("טקסט" in t and "קול" not in t)

    session.commit()

    next_idx = STEP_ORDER.index(current) + 1
    if next_idx < len(STEP_ORDER):
        next_step = STEP_ORDER[next_idx]
        state.set_state(session, user, state.ONBOARDING_PREFIX + next_step)
        return [_question(user, next_step)]

    return _finish(session, user, profile)


def _finish(session: Session, user: User, profile) -> list[str]:
    calories, protein = targets.compute_targets(
        gender=profile.gender, age=profile.age, height_cm=profile.height_cm,
        weight_kg=profile.start_weight_kg, goal_weight_kg=profile.goal_weight_kg,
        activity_level=profile.activity_level or "light",
    )
    profile.daily_calorie_target = calories
    profile.protein_target_g = protein
    user.status = "active"
    state.clear_state(session, user)
    session.commit()
    return [prompts.ONBOARDING_SUMMARY.format(
        name=user.name, current=profile.start_weight_kg, goal=profile.goal_weight_kg,
        calories=calories, protein=protein,
        morning=user.morning_hour.strftime("%H:%M"),
    )]
