"""Stage 5 acceptance: admin (Basic Auth) + landing both come up."""
from tests.helpers import make_active_user


def test_admin_requires_basic_auth(client):
    assert client.get("/admin").status_code == 401
    assert client.get("/admin", auth=("admin", "wrong")).status_code == 401


def test_admin_dashboard_lists_users(client):
    make_active_user("972501212121", name="יוסי")
    resp = client.get("/admin", auth=("admin", "admin-pass"))
    assert resp.status_code == 200
    assert "יוסי" in resp.text
    assert "972501212121" in resp.text


def test_admin_add_beta_user_starts_onboarding(client, outbox):
    resp = client.post("/admin/add-user", data={"name": "רות", "phone": "972503434343"},
                       auth=("admin", "admin-pass"), follow_redirects=False)
    assert resp.status_code == 303
    assert any(m["phone"] == "972503434343" and "איך קוראים לך" in m["text"] for m in outbox)

    from server.db.session import get_session
    from server.db import crud
    session = get_session()
    user = crud.get_user_by_phone(session, "972503434343")
    assert user.status == "onboarding"
    assert user.name == "רות"
    session.close()


def test_admin_manual_message(client, outbox):
    user_id = make_active_user("972505656565")
    resp = client.post("/admin/send", data={"user_id": user_id, "text": "היי, זה המאמן"},
                       auth=("admin", "admin-pass"), follow_redirects=False)
    assert resp.status_code == 303
    assert any(m["text"] == "היי, זה המאמן" for m in outbox)


def test_admin_user_page_shows_conversation(client, outbox):
    user_id = make_active_user("972507878787", name="דנה")
    client.post("/dev/simulate", json={"phone": "972507878787", "type": "text", "text": "אכלתי סלט"})
    resp = client.get(f"/admin/user/{user_id}", auth=("admin", "admin-pass"))
    assert resp.status_code == 200
    assert "ציר שיחה" in resp.text and "רשמתי" in resp.text


def test_admin_post_rejects_cross_origin(client, outbox):
    user_id = make_active_user("972509090909")
    resp = client.post("/admin/send", data={"user_id": user_id, "text": "פישינג"},
                       auth=("admin", "admin-pass"),
                       headers={"origin": "https://evil.example"},
                       follow_redirects=False)
    assert resp.status_code == 403
    assert not outbox  # nothing was sent

    resp = client.post("/admin/add-user", data={"name": "x", "phone": "972500000009"},
                       auth=("admin", "admin-pass"),
                       headers={"origin": "https://evil.example"},
                       follow_redirects=False)
    assert resp.status_code == 403


def test_landing_page_and_lead_form(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert 'dir="rtl"' in resp.text
    assert "אינו תחליף לייעוץ רפואי" in resp.text

    resp = client.post("/", data={"name": "אורי", "phone": "0501234567"})
    assert resp.status_code == 200
    assert "קיבלנו" in resp.text

    from server.db.session import get_session
    from server.db.models import Lead
    from sqlalchemy import select
    session = get_session()
    lead = session.scalars(select(Lead)).first()
    assert lead.name == "אורי" and lead.phone == "0501234567"
    session.close()
