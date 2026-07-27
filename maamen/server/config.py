"""Environment configuration. Everything is read from env vars with safe defaults.

MOCK_MODE=true (the default) means no external API is ever called and no real
key is required — all integrations go through server/integrations/mocks.py.
"""
import os
from functools import lru_cache
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent


def _bool(name: str, default: str = "true") -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes")


class Settings:
    def __init__(self) -> None:
        self.mock_mode: bool = _bool("MOCK_MODE", "true")

        self.green_api_id: str = os.getenv("GREEN_API_ID", "")
        self.green_api_token: str = os.getenv("GREEN_API_TOKEN", "")
        self.webhook_secret: str = os.getenv("WEBHOOK_SECRET", "dev-secret")

        self.anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
        self.openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
        self.elevenlabs_api_key: str = os.getenv("ELEVENLABS_API_KEY", "")
        self.elevenlabs_voice_id: str = os.getenv("ELEVENLABS_VOICE_ID", "")

        self.admin_user: str = os.getenv("ADMIN_USER", "naor")
        self.admin_pass: str = os.getenv("ADMIN_PASS", "")

        self.max_llm_calls_per_user_per_day: int = int(os.getenv("MAX_LLM_CALLS_PER_USER_PER_DAY", "30"))
        self.max_tts_per_user_per_day: int = int(os.getenv("MAX_TTS_PER_USER_PER_DAY", "3"))
        self.max_daily_cost_usd: float = float(os.getenv("MAX_DAILY_COST_USD", "15"))

        raw_db = os.getenv("DATABASE_PATH", "data/maamen.db")
        p = Path(raw_db)
        self.database_path: Path = p if p.is_absolute() else APP_ROOT / p

        self.scheduler_enabled: bool = _bool("SCHEDULER_ENABLED", "true")
        self.llm_model: str = os.getenv("LLM_MODEL", "claude-sonnet-4-6")
        self.timezone: str = "Asia/Jerusalem"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def reset_settings() -> None:
    """Test helper: re-read env vars on next get_settings()."""
    get_settings.cache_clear()
