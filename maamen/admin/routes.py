"""Admin dashboard (app #2): Basic Auth, vanilla HTML/JS, RTL Hebrew."""
import secrets
from datetime import timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.templating import Jinja2Templates
from sqlalchemy import select

from server.config import get_settings
from server.db import crud
from server.db.models import DailyPlan, Lead, Message, User, Weight
from server.db.session import get_session
from server.engine import onboarding
from server import messaging
from server.scheduler.jobs import scheduler_status
from server.utils import cost_guard
from server.utils.logging_setup import RECENT_ERRORS
from server.utils.timeutil import local_now, local_today

router = APIRouter(prefix="/admin")
security = HTTPBasic()
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))


def require_same_origin(request: Request) -> None:
    """CSRF guard for state-changing admin routes: browsers always send an
    Origin header on cross-site form POSTs — reject when it doesn't match us.
    Non-browser clients (no Origin/Referer) are unaffected."""
    from urllib.parse import urlparse

    origin = request.headers.get("origin") or request.headers.get("referer")
    if not origin:
        return
    if (urlparse(origin).hostname or "") != (request.url.hostname or ""):
        raise HTTPException(status_code=403, detail="cross-origin request rejected")


def require_admin(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    settings = get_settings()
    ok = (
        bool(settings.admin_pass)
        and secrets.compare_digest(credentials.username, settings.admin_user)
        and secrets.compare_digest(credentials.password, settings.admin_pass)
    )
    if not ok:
        raise HTTPException(status_code=401, headers={"WWW-Authenticate": "Basic"})
    return credentials.username


def _risk_key(user: User):
    """Sort: highest churn risk first."""
    last = user.last_inbound_at or user.created_at
    return (-user.missed_days_streak, last)


@router.get("", response_class=HTMLResponse)
def dashboard(request: Request, _admin: str = Depends(require_admin)):
    session = get_session()
    try:
        users = list(session.scalars(select(User)))
        rows = []
        today = local_today()
        for user in users:
            profile = crud.get_profile(session, user)
            weight = crud.latest_weight_before(session, user, today)
            prev = crud.latest_weight_before(session, user, today - timedelta(days=7))
            change = None
            if weight and prev and weight.id != prev.id:
                change = round(weight.weight_kg - prev.weight_kg, 1)
            emotional = crud.emotional_flags_this_week(
                session, user, today, ("stress", "bored", "social"))
            rows.append({
                "user": user, "profile": profile,
                "weight": weight.weight_kg if weight else None, "change": change,
                "emotional": emotional,
                "last_seen": user.last_inbound_at.strftime("%d/%m %H:%M") if user.last_inbound_at else "—",
            })
        rows.sort(key=lambda r: _risk_key(r["user"]))
        leads = list(session.scalars(select(Lead).order_by(Lead.created_at.desc()).limit(20)))
        return templates.TemplateResponse(request, "dashboard.html", {
            "rows": rows, "leads": leads,
            "costs": cost_guard.status(session),
            "errors": list(RECENT_ERRORS)[-10:],
            "scheduler": scheduler_status(),
        })
    finally:
        session.close()


@router.get("/user/{user_id}", response_class=HTMLResponse)
def user_page(request: Request, user_id: int, _admin: str = Depends(require_admin)):
    session = get_session()
    try:
        user = session.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=404)
        profile = crud.get_profile(session, user)
        msgs = list(session.scalars(
            select(Message).where(Message.user_id == user_id)
            .order_by(Message.created_at.desc()).limit(200)))[::-1]
        weights = list(session.scalars(
            select(Weight).where(Weight.user_id == user_id).order_by(Weight.date)))
        plans = list(session.scalars(
            select(DailyPlan).where(DailyPlan.user_id == user_id)
            .order_by(DailyPlan.date.desc()).limit(14)))
        return templates.TemplateResponse(request, "user.html", {
            "user": user, "profile": profile, "messages": msgs, "plans": plans,
            "weights": [{"date": w.date.strftime("%d/%m"), "kg": w.weight_kg} for w in weights],
        })
    finally:
        session.close()


@router.post("/send", dependencies=[Depends(require_same_origin)])
def send_manual(user_id: int = Form(...), text: str = Form(...), _admin: str = Depends(require_admin)):
    """Manual message from the admin — lands in the chat as if from the coach."""
    session = get_session()
    try:
        user = session.get(User, user_id)
        if user is None or not text.strip():
            raise HTTPException(status_code=400)
        messaging.send_text(session, user, text.strip())
        return RedirectResponse(url=f"/admin/user/{user_id}", status_code=303)
    finally:
        session.close()


@router.post("/add-user", dependencies=[Depends(require_same_origin)])
def add_beta_user(name: str = Form(...), phone: str = Form(...), _admin: str = Depends(require_admin)):
    """Add a beta user manually (anti-ban: the only path to messaging a new number)."""
    session = get_session()
    try:
        phone = "".join(ch for ch in phone if ch.isdigit())
        if not phone:
            raise HTTPException(status_code=400)
        user, created = crud.get_or_create_user(session, phone)
        if created:
            user.name = name.strip() or None
            session.commit()
            for reply in onboarding.start(session, user):
                messaging.send_text(session, user, reply)
        return RedirectResponse(url="/admin", status_code=303)
    finally:
        session.close()
