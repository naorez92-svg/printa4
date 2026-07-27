"""FastAPI app: Green API webhook, /dev/simulate, admin + landing mounts."""
import base64
import logging

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request

from server.config import get_settings
from server.db.session import init_db
from server.engine import router as engine_router
from server.integrations.green_api import get_wa_client
from server.utils.logging_setup import setup_logging

logger = logging.getLogger(__name__)

UNSUPPORTED_REPLY = "אני מבין טקסט, קול ותמונות 🙂"


def _extract_phone(sender: str) -> str:
    return (sender or "").split("@")[0]


def process_webhook_payload(payload: dict) -> None:
    """Runs in the background after the webhook already returned 200."""
    try:
        if payload.get("typeWebhook") != "incomingMessageReceived":
            return
        phone = _extract_phone(payload.get("senderData", {}).get("sender", ""))
        if not phone:
            return
        wa_id = payload.get("idMessage")
        mdata = payload.get("messageData", {})
        mtype = mdata.get("typeMessage", "")

        if mtype in ("textMessage", "extendedTextMessage"):
            text = (
                mdata.get("textMessageData", {}).get("textMessage")
                or mdata.get("extendedTextMessageData", {}).get("text", "")
            )
            engine_router.process_incoming(phone, "text", text=text, wa_message_id=wa_id)
        elif mtype == "imageMessage":
            url = mdata.get("fileMessageData", {}).get("downloadUrl", "")
            raw = get_wa_client().download_media(url) if url else b""
            image_b64 = base64.b64encode(raw).decode() if raw else None
            engine_router.process_incoming(phone, "image", image_b64=image_b64, wa_message_id=wa_id)
        elif mtype == "audioMessage":
            url = mdata.get("fileMessageData", {}).get("downloadUrl", "")
            audio = get_wa_client().download_media(url) if url else b""
            engine_router.process_incoming(phone, "voice", audio_bytes=audio, wa_message_id=wa_id)
        else:
            engine_router.process_incoming(phone, "unsupported", text=None, wa_message_id=wa_id)
    except Exception:
        logger.exception("webhook processing failed")


def create_app() -> FastAPI:
    setup_logging()
    settings = get_settings()
    init_db()
    app = FastAPI(title="MAAMEN", docs_url=None, redoc_url=None)

    @app.post("/webhook/green")
    async def green_webhook(request: Request, background_tasks: BackgroundTasks, token: str = Query("")):
        if token != settings.webhook_secret:
            raise HTTPException(status_code=403, detail="bad token")
        try:
            payload = await request.json()
        except Exception:
            return {"ok": True}
        # answer 200 immediately; Green API re-delivers otherwise
        background_tasks.add_task(process_webhook_payload, payload)
        return {"ok": True}

    if settings.mock_mode:
        @app.post("/dev/simulate")
        async def dev_simulate(request: Request):
            """Inject a simulated inbound message (MOCK_MODE only) and return replies."""
            body = await request.json()
            phone = str(body.get("phone", "972500000000"))
            mtype = body.get("type", "text")
            replies = engine_router.process_incoming(
                phone, mtype,
                text=body.get("text"),
                image_b64=body.get("image_b64"),
                audio_bytes=b"MOCK_MEDIA" if mtype == "voice" else None,
                wa_message_id=body.get("wa_message_id"),
            )
            return {"replies": replies}

    @app.get("/health")
    async def health():
        return {"ok": True, "mock_mode": settings.mock_mode}

    @app.on_event("startup")
    def _startup() -> None:
        if settings.scheduler_enabled:
            try:
                from server.scheduler.jobs import start_scheduler
                start_scheduler()
            except Exception:
                logger.exception("scheduler failed to start")

    return app


def __getattr__(name: str):
    # `uvicorn server.main:app` builds the app lazily, so tests can set env first
    if name == "app":
        return create_app()
    raise AttributeError(name)
