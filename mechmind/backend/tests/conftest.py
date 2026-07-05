import os
import tempfile

# חייב לרוץ לפני ייבוא backend — קובע DB ותוצרים זמניים ומכבה rate-limit
_tmp = tempfile.mkdtemp(prefix="mechmind_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ARTIFACTS_DIR"] = f"{_tmp}/artifacts"
os.environ["RATE_LIMIT_SECONDS"] = "0"
os.environ.setdefault("ANTHROPIC_API_KEY", "")

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture()
def client():
    return TestClient(app)
