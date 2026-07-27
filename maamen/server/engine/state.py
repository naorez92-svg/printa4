"""Per-user conversation state machine, stored on the users row."""
import json

from sqlalchemy.orm import Session

from server.db.models import User

# state values
ONBOARDING_PREFIX = "onboarding:"          # onboarding:<step-key>
AWAITING_PLAN_CONTEXT = "awaiting_plan_context"      # morning question sent
AWAITING_MEAL_CLARIFICATION = "awaiting_meal_clarification"
AWAITING_EMOTIONAL_ANSWER = "awaiting_emotional_answer"


def get_state(user: User) -> str | None:
    return user.conversation_state


def get_payload(user: User) -> dict:
    if not user.state_payload:
        return {}
    try:
        return json.loads(user.state_payload)
    except json.JSONDecodeError:
        return {}


def set_state(session: Session, user: User, state: str | None, payload: dict | None = None) -> None:
    user.conversation_state = state
    user.state_payload = json.dumps(payload, ensure_ascii=False) if payload else None
    session.commit()


def clear_state(session: Session, user: User) -> None:
    set_state(session, user, None, None)
