"""Landing page (app #3): one static Hebrew RTL page + lead form."""
import logging
from pathlib import Path

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from server.db import crud
from server.db.session import get_session

logger = logging.getLogger(__name__)

router = APIRouter()
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))


@router.get("/", response_class=HTMLResponse)
def landing(request: Request):
    return templates.TemplateResponse(request, "index.html", {"submitted": False})


@router.post("/", response_class=HTMLResponse)
def submit_lead(request: Request, name: str = Form(""), phone: str = Form("")):
    name = name.strip()[:120]
    phone = "".join(ch for ch in phone if ch.isdigit())[:32]
    if name and phone:
        session = get_session()
        try:
            crud.add_lead(session, name, phone)
            # admin notification: the lead shows up on the admin dashboard
            logger.warning("new lead from landing page: %s", name)
        finally:
            session.close()
        return templates.TemplateResponse(request, "index.html", {"submitted": True})
    return templates.TemplateResponse(request, "index.html", {"submitted": False})
