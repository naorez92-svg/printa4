import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture()
def app_env(tmp_path, monkeypatch):
    """Fresh settings + fresh SQLite DB per test."""
    monkeypatch.setenv("MOCK_MODE", "true")
    monkeypatch.setenv("SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("WEBHOOK_SECRET", "test-secret")
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("ADMIN_USER", "admin")
    monkeypatch.setenv("ADMIN_PASS", "admin-pass")

    from server.config import reset_settings
    from server.db.session import reset_db, init_db
    from server.integrations import mocks

    reset_settings()
    reset_db()
    init_db()
    mocks.MOCK_GREEN.outbox.clear()
    yield
    reset_settings()
    reset_db()


@pytest.fixture()
def client(app_env):
    from fastapi.testclient import TestClient
    from server.main import create_app

    with TestClient(create_app()) as c:
        yield c


@pytest.fixture()
def outbox(app_env):
    from server.integrations.mocks import MOCK_GREEN
    return MOCK_GREEN.outbox
