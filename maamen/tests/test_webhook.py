"""Stage 1 acceptance: webhook auth, dedup, persistence + echo via /dev/simulate."""


def _green_payload(text="שלום", msg_id="MSG-1", phone="972501111111"):
    return {
        "typeWebhook": "incomingMessageReceived",
        "idMessage": msg_id,
        "senderData": {"sender": f"{phone}@c.us"},
        "messageData": {
            "typeMessage": "textMessage",
            "textMessageData": {"textMessage": text},
        },
    }


def test_webhook_rejects_bad_token(client):
    resp = client.post("/webhook/green?token=wrong", json=_green_payload())
    assert resp.status_code == 403


def test_webhook_accepts_and_persists(client):
    resp = client.post("/webhook/green?token=test-secret", json=_green_payload())
    assert resp.status_code == 200

    from server.db.session import get_session
    from server.db.models import Message, User
    from sqlalchemy import select

    session = get_session()
    user = session.scalar(select(User).where(User.phone == "972501111111"))
    assert user is not None
    inbound = session.scalars(select(Message).where(Message.direction == "in")).all()
    assert len(inbound) == 1
    assert inbound[0].wa_message_id == "MSG-1"
    session.close()


def test_webhook_dedup_same_message_id(client):
    client.post("/webhook/green?token=test-secret", json=_green_payload(msg_id="DUP-1"))
    client.post("/webhook/green?token=test-secret", json=_green_payload(msg_id="DUP-1"))

    from server.db.session import get_session
    from server.db.models import Message
    from sqlalchemy import select

    session = get_session()
    inbound = session.scalars(select(Message).where(Message.direction == "in")).all()
    assert len(inbound) == 1
    session.close()


def test_simulate_saves_and_replies(client, outbox):
    resp = client.post("/dev/simulate", json={"phone": "972502222222", "type": "text", "text": "בדיקה"})
    assert resp.status_code == 200
    assert resp.json()["replies"]
    assert outbox, "a reply must be sent through the (mock) WhatsApp client"
    assert outbox[-1]["phone"] == "972502222222"
