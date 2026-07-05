"""MechMind · מהנדס-העל — שרת FastAPI ראשי."""
from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from .config import settings
from .db import Base, engine, get_db
from .llm import LLMUnavailable
from .models import Artifact, ChatSession, Job, Message
from .modules.cad_engine import generate_cad
from .modules.drawing_reader import MAX_UPLOAD_BYTES, read_drawing
from .modules.material_advisor import advise_material
from .modules.process_planner import plan_process
from .modules.project_translator import translate_to_project
from .modules.strength_engine import check_strength
from .core.materials import load_materials
from .core.processes import load_processes
from .orchestrator import run_chat

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MechMind · מהנדס-העל", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ---------------------------------------------------------------------------
# הגבלת קצב פשוטה לבקשות יקרות (בזיכרון, לכל IP)
# ---------------------------------------------------------------------------
_last_request: dict[str, float] = {}


def rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    last = _last_request.get(ip, 0.0)
    wait = settings.rate_limit_seconds - (now - last)
    if wait > 0:
        raise HTTPException(429, detail=f"יותר מדי בקשות — נסה שוב בעוד {int(wait) + 1} שניות.")
    _last_request[ip] = now
    if len(_last_request) > 10_000:  # מניעת תפיחת זיכרון
        cutoff = now - 3600
        for k in [k for k, v in _last_request.items() if v < cutoff]:
            _last_request.pop(k, None)


def _llm_unavailable(e: LLMUnavailable) -> HTTPException:
    return HTTPException(503, detail=str(e))


# ---------------------------------------------------------------------------
# סכימות בקשה
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    session_id: int | None = None


class CadRequest(BaseModel):
    description_he: str = Field(min_length=3, max_length=4000)
    material_id: str = "al6061"
    quantity: int = Field(default=1, ge=1, le=1_000_000)
    session_id: int | None = None


class StrengthRequest(BaseModel):
    element_type: str
    case: str | None = None
    length_mm: float
    section_type: str
    section_dims: dict
    material_id: str
    load_n: float | None = None
    udl_n_per_mm: float | None = None
    support_positions_mm: list[float] | None = None
    point_loads: list[dict] | None = None
    is_dynamic_load: bool = False
    is_fatigue: bool = False
    is_pressure_vessel: bool = False
    session_id: int | None = None


class MaterialRequest(BaseModel):
    min_yield_mpa: float = 0
    max_density_g_cm3: float | None = None
    min_corrosion_resistance: int = Field(default=1, ge=1, le=5)
    min_service_temp_c: float | None = None
    max_price_ils_per_kg: float | None = None
    prefer: str = "balanced"
    classes: list[str] | None = None
    context_he: str = ""
    session_id: int | None = None


class ProcessRequest(BaseModel):
    material_id: str
    geometry: str
    quantity: int = Field(ge=1)
    volume_cm3: float = Field(gt=0)
    context_he: str = ""
    session_id: int | None = None


class ProjectRequest(BaseModel):
    source_description_he: str = Field(min_length=3, max_length=12000)
    session_id: int | None = None


# ---------------------------------------------------------------------------
# עזרי DB
# ---------------------------------------------------------------------------
def _ensure_session(db: DBSession, session_id: int | None) -> ChatSession:
    if session_id is not None:
        existing = db.get(ChatSession, session_id)
        if existing:
            return existing
    session = ChatSession()
    db.add(session)
    db.commit()
    return session


def _persist_result(db: DBSession, session_id: int, module: str, result: dict) -> list[dict]:
    """שומר Job + Artifacts ומחזיר רשימת קבצים עם קישורי הורדה."""
    db.add(Job(session_id=session_id, module=module,
               status=result.get("status", "error"),
               summary=result.get("summary_he", "")[:2000]))
    saved = []
    for a in result.get("artifacts") or []:
        row = Artifact(session_id=session_id, module=a.get("module", module),
                       kind=a["kind"], filename=a["filename"], path=a["path"],
                       meta_json=json.dumps(a.get("meta", {}), ensure_ascii=False))
        db.add(row)
        db.flush()
        saved.append({"id": row.id, "kind": row.kind, "filename": row.filename,
                      "module": row.module, "download_url": f"/api/artifacts/{row.id}/download"})
    db.commit()
    return saved


def _module_response(db: DBSession, session_id: int | None, module: str, result: dict) -> dict:
    session = _ensure_session(db, session_id)
    files = _persist_result(db, session.id, module, result)
    return {"session_id": session.id, "status": result.get("status"),
            "summary_he": result.get("summary_he"), "data": result.get("data"),
            "artifacts": files}


# ---------------------------------------------------------------------------
# נקודות קצה
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "product": "MechMind", "version": "1.0.0",
            "ai_enabled": bool(settings.anthropic_api_key)}


@app.get("/api/catalog")
def catalog() -> dict:
    """קטלוג חומרים ותהליכים לתצוגה ב-UI."""
    return {"materials": load_materials(), "processes": load_processes()}


@app.post("/api/chat")
def chat(req: ChatRequest, request: Request, db: DBSession = Depends(get_db)):
    rate_limit(request)
    session = _ensure_session(db, req.session_id)
    history_rows = (db.query(Message).filter(Message.session_id == session.id)
                    .order_by(Message.id).limit(40).all())
    history = [{"role": m.role, "content": m.content} for m in history_rows]

    try:
        result = run_chat(history, req.message)
    except LLMUnavailable as e:
        raise _llm_unavailable(e) from e

    db.add(Message(session_id=session.id, role="user", content=req.message))
    db.add(Message(session_id=session.id, role="assistant", content=result["reply_he"]))
    for j in result["jobs"]:
        db.add(Job(session_id=session.id, module=j["module"], status=j["status"],
                   summary=j["summary"]))
    files = []
    for a in result["artifacts"]:
        row = Artifact(session_id=session.id, module=a.get("module", "M-00"),
                       kind=a["kind"], filename=a["filename"], path=a["path"])
        db.add(row)
        db.flush()
        files.append({"id": row.id, "kind": row.kind, "filename": row.filename,
                      "module": row.module, "download_url": f"/api/artifacts/{row.id}/download"})
    db.commit()

    return {"session_id": session.id, "reply_he": result["reply_he"],
            "artifacts": files, "jobs": result["jobs"]}


@app.post("/api/cad")
def cad(req: CadRequest, request: Request, db: DBSession = Depends(get_db)):
    rate_limit(request)
    try:
        result = generate_cad(req.description_he, req.material_id, req.quantity)
    except LLMUnavailable as e:
        raise _llm_unavailable(e) from e
    return _module_response(db, req.session_id, "M-01", result)


@app.post("/api/strength")
def strength(req: StrengthRequest, db: DBSession = Depends(get_db)):
    result = check_strength(**req.model_dump(exclude={"session_id"}))
    return _module_response(db, req.session_id, "M-02", result)


@app.post("/api/material")
def material(req: MaterialRequest, db: DBSession = Depends(get_db)):
    result = advise_material(**req.model_dump(exclude={"session_id"}))
    return _module_response(db, req.session_id, "M-03", result)


@app.post("/api/process")
def process(req: ProcessRequest, db: DBSession = Depends(get_db)):
    result = plan_process(**req.model_dump(exclude={"session_id"}))
    return _module_response(db, req.session_id, "M-04", result)


@app.post("/api/drawing")
async def drawing(request: Request,
                  file: UploadFile = File(...),
                  note: str = Form(default=""),
                  session_id: int | None = Form(default=None),
                  db: DBSession = Depends(get_db)):
    rate_limit(request)
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, detail="הקובץ גדול מ-10MB.")
    try:
        result = read_drawing(content, file.content_type or "", user_note_he=note[:2000])
    except LLMUnavailable as e:
        raise _llm_unavailable(e) from e
    return _module_response(db, session_id, "M-05", result)


@app.post("/api/project")
def project(req: ProjectRequest, request: Request, db: DBSession = Depends(get_db)):
    rate_limit(request)
    try:
        result = translate_to_project(req.source_description_he)
    except LLMUnavailable as e:
        raise _llm_unavailable(e) from e
    return _module_response(db, req.session_id, "M-06", result)


@app.get("/api/artifacts/{artifact_id}/download")
def download_artifact(artifact_id: int, db: DBSession = Depends(get_db)):
    row = db.get(Artifact, artifact_id)
    if row is None:
        raise HTTPException(404, detail="הקובץ לא נמצא.")
    file_path = Path(row.path).resolve()
    artifacts_root = settings.artifacts_path.resolve()
    # הגנת path traversal — מגישים אך ורק קבצים מתוך תיקיית התוצרים
    if not file_path.is_relative_to(artifacts_root) or not file_path.is_file():
        raise HTTPException(404, detail="הקובץ לא נמצא.")
    media_types = {"step": "application/step", "dxf": "application/dxf",
                   "svg": "image/svg+xml", "pdf": "application/pdf",
                   "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                   "json": "application/json"}
    return FileResponse(file_path, filename=row.filename,
                        media_type=media_types.get(row.kind, "application/octet-stream"))


@app.get("/api/sessions/{session_id}/artifacts")
def session_artifacts(session_id: int, db: DBSession = Depends(get_db)):
    rows = (db.query(Artifact).filter(Artifact.session_id == session_id)
            .order_by(Artifact.id.desc()).limit(100).all())
    return {"artifacts": [
        {"id": r.id, "kind": r.kind, "filename": r.filename, "module": r.module,
         "created_at": r.created_at.isoformat(),
         "download_url": f"/api/artifacts/{r.id}/download"} for r in rows]}
