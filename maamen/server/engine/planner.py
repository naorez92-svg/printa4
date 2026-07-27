"""Morning day-planning — filled in at the proactive stage."""
from datetime import datetime

from sqlalchemy.orm import Session

from server.db.models import User
from server.engine import prompts, state


def handle_context_reply(session: Session, user: User, text: str, now: datetime) -> list[str]:
    state.clear_state(session, user)
    return [prompts.TEMPLATE_FALLBACK_REPLY]  # stage 4
