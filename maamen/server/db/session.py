"""Engine / session management. SQLite file path comes from settings."""
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from server.config import get_settings
from server.db.models import Base

_engine = None
_SessionLocal = None


def _build_engine():
    settings = get_settings()
    db_path: Path = settings.database_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )


def init_db() -> None:
    global _engine, _SessionLocal
    _engine = _build_engine()
    _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)
    Base.metadata.create_all(_engine)


def reset_db() -> None:
    """Test helper: drop the cached engine so the next init_db() re-reads settings."""
    global _engine, _SessionLocal
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _SessionLocal = None


def get_session() -> Session:
    if _SessionLocal is None:
        init_db()
    return _SessionLocal()
