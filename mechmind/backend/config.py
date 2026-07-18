"""הגדרות MechMind — כל הסודות מגיעים מ-.env, לעולם לא מהקוד."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    anthropic_api_key: str = ""
    mechmind_model: str = "claude-sonnet-5"
    database_url: str = f"sqlite:///{BASE_DIR / 'mechmind.db'}"
    artifacts_dir: str = str(BASE_DIR / "artifacts")
    cors_origins: str = "http://localhost:5173"
    rate_limit_seconds: int = 15

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def artifacts_path(self) -> Path:
        p = Path(self.artifacts_dir)
        if not p.is_absolute():
            p = BASE_DIR / p
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
settings.artifacts_path  # יוצר את תיקיית התוצרים בעליית האפליקציה (ה-property עושה mkdir)
