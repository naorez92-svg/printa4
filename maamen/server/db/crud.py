"""DB helpers shared by the engine, scheduler and admin."""
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from server.db.models import (
    ApiCost, DailyPlan, Lead, Meal, Message, Profile, User, UserDailyUsage, Weight,
)


def get_user_by_phone(session: Session, phone: str) -> User | None:
    return session.scalar(select(User).where(User.phone == phone))


def get_or_create_user(session: Session, phone: str) -> tuple[User, bool]:
    user = get_user_by_phone(session, phone)
    if user:
        return user, False
    user = User(phone=phone, status="onboarding")
    session.add(user)
    session.commit()
    return user, True


def get_profile(session: Session, user: User) -> Profile:
    profile = session.get(Profile, user.id)
    if profile is None:
        profile = Profile(user_id=user.id)
        session.add(profile)
        session.commit()
    return profile


def record_inbound(
    session: Session, user: User, msg_type: str, content: str | None,
    wa_message_id: str | None, now: datetime | None = None,
) -> Message | None:
    """Save an inbound message. Returns None on duplicate wa_message_id (dedup)."""
    if wa_message_id:
        existing = session.scalar(select(Message).where(Message.wa_message_id == wa_message_id))
        if existing:
            return None
    msg = Message(
        user_id=user.id, direction="in", msg_type=msg_type,
        content=content, wa_message_id=wa_message_id,
    )
    session.add(msg)
    user.last_inbound_at = now or datetime.utcnow()
    user.missed_days_streak = 0
    try:
        session.commit()
    except IntegrityError:  # concurrent duplicate
        session.rollback()
        return None
    return msg


def record_outbound(session: Session, user: User, msg_type: str, content: str | None) -> Message:
    msg = Message(user_id=user.id, direction="out", msg_type=msg_type, content=content)
    session.add(msg)
    session.commit()
    return msg


def meals_for_day(session: Session, user: User, day: date) -> list[Meal]:
    return list(session.scalars(
        select(Meal).where(Meal.user_id == user.id, Meal.date == day).order_by(Meal.time)
    ))


def calories_for_day(session: Session, user: User, day: date) -> int:
    total = session.scalar(
        select(func.coalesce(func.sum(Meal.calories_est), 0))
        .where(Meal.user_id == user.id, Meal.date == day)
    )
    return int(total or 0)


def plan_for_day(session: Session, user: User, day: date) -> DailyPlan | None:
    return session.scalar(
        select(DailyPlan).where(DailyPlan.user_id == user.id, DailyPlan.date == day)
        .order_by(DailyPlan.created_at.desc())
    )


def log_weight(session: Session, user: User, day: date, weight_kg: float) -> None:
    existing = session.scalar(
        select(Weight).where(Weight.user_id == user.id, Weight.date == day)
    )
    if existing:
        existing.weight_kg = weight_kg
    else:
        session.add(Weight(user_id=user.id, date=day, weight_kg=weight_kg))
    session.commit()


def latest_weight_before(session: Session, user: User, day: date) -> Weight | None:
    return session.scalar(
        select(Weight).where(Weight.user_id == user.id, Weight.date <= day)
        .order_by(Weight.date.desc())
    )


def emotional_flags_this_week(session: Session, user: User, day: date, flag_values: tuple[str, ...]) -> int:
    week_start = day - timedelta(days=day.weekday() + 1 if day.weekday() < 6 else 0)  # Sunday
    return session.scalar(
        select(func.count(Meal.id)).where(
            Meal.user_id == user.id,
            Meal.date >= week_start,
            Meal.date <= day,
            Meal.emotional_flag.in_(flag_values),
        )
    ) or 0


def get_usage(session: Session, user_id: int, day: date) -> UserDailyUsage:
    usage = session.scalar(select(UserDailyUsage).where(
        UserDailyUsage.user_id == user_id, UserDailyUsage.date == day
    ))
    if usage is None:
        usage = UserDailyUsage(user_id=user_id, date=day)
        session.add(usage)
        session.commit()
    return usage


def add_api_cost(session: Session, day: date, provider: str, cost_usd: float) -> None:
    row = session.scalar(select(ApiCost).where(ApiCost.date == day, ApiCost.provider == provider))
    if row is None:
        row = ApiCost(date=day, provider=provider, calls=0, est_cost_usd=0.0)
        session.add(row)
    row.calls += 1
    row.est_cost_usd += cost_usd
    session.commit()


def total_cost_for_day(session: Session, day: date) -> float:
    return float(session.scalar(
        select(func.coalesce(func.sum(ApiCost.est_cost_usd), 0.0)).where(ApiCost.date == day)
    ) or 0.0)


def delete_user_data(session: Session, user: User) -> None:
    """'הסר/מחק אותי' — wipe personal data, keep an anonymized user row as churned."""
    for model in (Meal, DailyPlan, Weight, Message, UserDailyUsage):
        for row in session.scalars(select(model).where(model.user_id == user.id)):
            session.delete(row)
    profile = session.get(Profile, user.id)
    if profile:
        session.delete(profile)
    user.name = None
    user.status = "churned"
    user.conversation_state = None
    user.state_payload = None
    session.commit()


def add_lead(session: Session, name: str, phone: str) -> Lead:
    lead = Lead(name=name, phone=phone)
    session.add(lead)
    session.commit()
    return lead
