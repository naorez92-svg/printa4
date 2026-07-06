"""בדיקות API מקצה לקצה (בלי LLM — נקודות קצה דטרמיניסטיות + חסימות)."""
import io


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["product"] == "MechMind"


def test_catalog(client):
    r = client.get("/api/catalog")
    assert r.status_code == 200
    assert len(r.json()["materials"]) >= 10
    assert len(r.json()["processes"]) >= 5


def test_strength_endpoint_full_flow(client):
    r = client.post("/api/strength", json={
        "element_type": "beam_analytic", "case": "simply_supported_point",
        "length_mm": 1000, "section_type": "rectangle",
        "section_dims": {"width_mm": 20, "height_mm": 40},
        "material_id": "s235jr", "load_n": 1000,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["data"]["safety_factor"] == 5.01
    assert "אומדן ראשוני" in body["summary_he"]
    assert body["session_id"] > 0


def test_strength_dynamic_flagged(client):
    r = client.post("/api/strength", json={
        "element_type": "beam_analytic", "case": "cantilever_point",
        "length_mm": 500, "section_type": "circle",
        "section_dims": {"diameter_mm": 20},
        "material_id": "c45", "load_n": 100, "is_dynamic_load": True,
    })
    assert r.json()["status"] == "needs_engineer"


def test_material_endpoint(client):
    r = client.post("/api/material", json={
        "min_yield_mpa": 200, "max_density_g_cm3": 3.0, "prefer": "weight",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    ids = [c["id"] for c in body["data"]["candidates"]]
    assert set(ids) <= {"al6061", "al7075"}


def test_process_endpoint(client):
    r = client.post("/api/process", json={
        "material_id": "al6061", "geometry": "prismatic",
        "quantity": 50, "volume_cm3": 80,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["data"]["recommended"]["unit_cost_ils"] > 0


def test_process_invalid_geometry(client):
    r = client.post("/api/process", json={
        "material_id": "al6061", "geometry": "banana",
        "quantity": 50, "volume_cm3": 80,
    })
    assert r.json()["status"] == "error"


def test_chat_without_api_key_returns_503(client):
    r = client.post("/api/chat", json={"message": "שלום"})
    assert r.status_code == 503
    assert "ANTHROPIC_API_KEY" in r.json()["detail"]


def test_cad_without_api_key_returns_503(client):
    r = client.post("/api/cad", json={"description_he": "קוביה 10 מ\"מ"})
    assert r.status_code == 503


def test_drawing_upload_too_large(client):
    big = io.BytesIO(b"x" * (11 * 1024 * 1024))
    r = client.post("/api/drawing", files={"file": ("big.png", big, "image/png")})
    assert r.status_code == 413


def test_artifact_download_missing(client):
    assert client.get("/api/artifacts/nosuchtoken/download").status_code == 404


def test_artifact_path_traversal_blocked(client):
    """Artifact שמצביע מחוץ לתיקיית התוצרים — לא מוגש, גם עם token תקין."""
    from backend.db import SessionLocal
    from backend.models import Artifact
    db = SessionLocal()
    row = Artifact(session_id=None, module="M-01", kind="step",
                   filename="passwd", path="/etc/passwd")
    db.add(row)
    db.commit()
    token = row.token
    db.close()
    r = client.get(f"/api/artifacts/{token}/download")
    assert r.status_code == 404


def test_session_requires_token_to_resume(client):
    """סשן קיים אינו נגיש ללא ה-token — מונע חטיפה בניחוש מזהה סדרתי."""
    r1 = client.post("/api/strength", json={
        "element_type": "beam_analytic", "case": "simply_supported_point",
        "length_mm": 1000, "section_type": "rectangle",
        "section_dims": {"width_mm": 20, "height_mm": 40},
        "material_id": "s235jr", "load_n": 1000,
    })
    body1 = r1.json()
    sid, token = body1["session_id"], body1["session_token"]
    assert token

    # אותו session_id בלי token → נפתח סשן חדש (לא מצטרף לקיים)
    r2 = client.post("/api/strength", json={
        "element_type": "beam_analytic", "case": "simply_supported_point",
        "length_mm": 1000, "section_type": "rectangle",
        "section_dims": {"width_mm": 20, "height_mm": 40},
        "material_id": "s235jr", "load_n": 1000, "session_id": sid,
    })
    assert r2.json()["session_id"] != sid

    # עם ה-token הנכון → מצטרף לאותו סשן
    r3 = client.post("/api/strength", json={
        "element_type": "beam_analytic", "case": "simply_supported_point",
        "length_mm": 1000, "section_type": "rectangle",
        "section_dims": {"width_mm": 20, "height_mm": 40},
        "material_id": "s235jr", "load_n": 1000,
        "session_id": sid, "session_token": token,
    })
    assert r3.json()["session_id"] == sid


def test_session_artifacts_requires_token(client):
    r = client.post("/api/strength", json={
        "element_type": "beam_analytic", "case": "simply_supported_point",
        "length_mm": 1000, "section_type": "rectangle",
        "section_dims": {"width_mm": 20, "height_mm": 40},
        "material_id": "s235jr", "load_n": 1000,
    })
    body = r.json()
    sid, token = body["session_id"], body["session_token"]
    assert client.get(f"/api/sessions/{sid}/artifacts?token=wrong").status_code == 404
    assert client.get(f"/api/sessions/{sid}/artifacts?token={token}").status_code == 200


def test_strength_safety_required_flag(client):
    r = client.post("/api/strength", json={
        "element_type": "beam_analytic", "case": "simply_supported_point",
        "length_mm": 1000, "section_type": "rectangle",
        "section_dims": {"width_mm": 20, "height_mm": 40},
        "material_id": "s235jr", "load_n": 1000,
    })
    assert r.json()["safety_required"] is True


def test_chat_message_validation(client):
    assert client.post("/api/chat", json={"message": ""}).status_code == 422
    assert client.post("/api/chat", json={"message": "x" * 9000}).status_code == 422
