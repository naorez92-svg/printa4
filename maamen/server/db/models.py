"""SQLAlchemy 2.x models — schema per build-plan section 4."""
from datetime import datetime, date, time

from sqlalchemy import (
    Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # onboarding / active / paused / churned / blocked
    status: Mapped[str] = mapped_column(String(20), default="onboarding")
    medical_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    tz: Mapped[str] = mapped_column(String(64), default="Asia/Jerusalem")
    morning_hour: Mapped[time] = mapped_column(Time, default=time(7, 30))
    evening_hour: Mapped[time] = mapped_column(Time, default=time(20, 30))
    voice_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_inbound_at: Mapped[datetime | None] = mapped_column(DateTime)
    missed_days_streak: Mapped[int] = mapped_column(Integer, default=0)
    # conversation state machine (see DECISIONS.md)
    conversation_state: Mapped[str | None] = mapped_column(String(64))
    state_payload: Mapped[str | None] = mapped_column(Text)


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    gender: Mapped[str | None] = mapped_column(String(10))  # male / female
    age: Mapped[int | None] = mapped_column(Integer)
    height_cm: Mapped[int | None] = mapped_column(Integer)
    start_weight_kg: Mapped[float | None] = mapped_column(Float)
    goal_weight_kg: Mapped[float | None] = mapped_column(Float)
    activity_level: Mapped[str | None] = mapped_column(String(20))
    work_pattern: Mapped[str | None] = mapped_column(Text)
    family_context: Mapped[str | None] = mapped_column(Text)
    kosher: Mapped[bool] = mapped_column(Boolean, default=False)
    shomer_shabbat: Mapped[bool] = mapped_column(Boolean, default=False)
    eating_triggers: Mapped[str | None] = mapped_column(Text)
    daily_calorie_target: Mapped[int | None] = mapped_column(Integer)
    protein_target_g: Mapped[int | None] = mapped_column(Integer)


class DailyPlan(Base):
    __tablename__ = "daily_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    plan_json: Mapped[str] = mapped_column(Text)  # list of planned meals
    planned_calories: Mapped[int | None] = mapped_column(Integer)
    context_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Meal(Base):
    __tablename__ = "meals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    time: Mapped[time] = mapped_column(Time)
    source: Mapped[str] = mapped_column(String(10))  # photo / voice / text
    description: Mapped[str] = mapped_column(Text)
    calories_est: Mapped[int | None] = mapped_column(Integer)
    protein_est: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[str | None] = mapped_column(String(10))  # high/medium/low
    matched_plan: Mapped[bool] = mapped_column(Boolean, default=False)
    emotional_flag: Mapped[str | None] = mapped_column(String(10))  # hungry/bored/stress/social
    image_ref: Mapped[str | None] = mapped_column(Text)


class Weight(Base):
    __tablename__ = "weights"
    __table_args__ = (UniqueConstraint("user_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date)
    weight_kg: Mapped[float] = mapped_column(Float)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    direction: Mapped[str] = mapped_column(String(3))  # in / out
    msg_type: Mapped[str] = mapped_column(String(20))  # text / voice / image / system
    content: Mapped[str | None] = mapped_column(Text)
    wa_message_id: Mapped[str | None] = mapped_column(String(128), unique=True)  # dedup
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ApiCost(Base):
    __tablename__ = "api_costs"
    __table_args__ = (UniqueConstraint("date", "provider"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    provider: Mapped[str] = mapped_column(String(20))
    calls: Mapped[int] = mapped_column(Integer, default=0)
    est_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)


class UserDailyUsage(Base):
    """Per-user daily API counters for cost caps (see DECISIONS.md)."""
    __tablename__ = "user_daily_usage"
    __table_args__ = (UniqueConstraint("user_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date)
    llm_calls: Mapped[int] = mapped_column(Integer, default=0)
    tts_calls: Mapped[int] = mapped_column(Integer, default=0)


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
