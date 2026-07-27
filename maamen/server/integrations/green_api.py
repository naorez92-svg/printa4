"""Green API client (outgoing WhatsApp) + global 1 msg/sec rate limit.

anti-ban: sending is allowed only to numbers that exist in our users table —
i.e. someone who wrote to us first, or was added manually via the admin.
The engine only ever calls send_* with a User loaded from the DB.
"""
import logging
import threading
import time as _time

import requests

from server.config import get_settings
from server.integrations import mocks

logger = logging.getLogger(__name__)

_send_lock = threading.Lock()
_last_send_ts = 0.0


def _rate_limit() -> None:
    """Global: max one outgoing message per second (simple queue via lock)."""
    global _last_send_ts
    with _send_lock:
        now = _time.monotonic()
        wait = 1.0 - (now - _last_send_ts)
        if wait > 0:
            _time.sleep(wait)
        _last_send_ts = _time.monotonic()


class GreenAPI:
    def __init__(self) -> None:
        s = get_settings()
        self.base = f"https://api.green-api.com/waInstance{s.green_api_id}"
        self.token = s.green_api_token

    def _chat_id(self, phone: str) -> str:
        return f"{phone}@c.us"

    def send_text(self, phone: str, text: str) -> None:
        _rate_limit()
        try:
            requests.post(
                f"{self.base}/sendMessage/{self.token}",
                json={"chatId": self._chat_id(phone), "message": text},
                timeout=15,
            ).raise_for_status()
        except Exception:
            logger.exception("Green API sendMessage failed")

    def send_voice(self, phone: str, audio: bytes, caption: str | None = None) -> None:
        _rate_limit()
        try:
            requests.post(
                f"{self.base}/sendFileByUpload/{self.token}",
                data={"chatId": self._chat_id(phone), "fileName": "coach.mp3", "caption": caption or ""},
                files={"file": ("coach.mp3", audio, "audio/mpeg")},
                timeout=30,
            ).raise_for_status()
        except Exception:
            logger.exception("Green API sendFileByUpload failed")

    def download_media(self, url: str) -> bytes:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content


def get_wa_client():
    if get_settings().mock_mode:
        return mocks.MOCK_GREEN
    return GreenAPI()
