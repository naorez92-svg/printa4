"""Full mock layer — everything the app touches externally, simulated.

All development and tests run with MOCK_MODE=true and zero real API keys.
"""
import json


class MockGreenAPI:
    """Records outgoing WhatsApp messages instead of sending them."""

    def __init__(self) -> None:
        self.outbox: list[dict] = []

    def send_text(self, phone: str, text: str) -> None:
        self.outbox.append({"phone": phone, "type": "text", "text": text})

    def send_voice(self, phone: str, audio: bytes, caption: str | None = None) -> None:
        self.outbox.append({"phone": phone, "type": "voice", "bytes": len(audio), "caption": caption})

    def download_media(self, url: str) -> bytes:
        return b"MOCK_MEDIA"


MOCK_GREEN = MockGreenAPI()


def mock_transcribe(audio: bytes) -> str:
    """Mock Whisper: fixed Hebrew meal description."""
    return "אכלתי שניצל עם אורז"


def mock_tts(text: str) -> bytes:
    return b"MOCK_AUDIO:" + text.encode("utf-8")[:32]


def mock_llm(system: str, user_content, max_tokens: int = 1000) -> str:
    """Deterministic keyword-driven LLM mock covering every prompt kind."""
    text = user_content if isinstance(user_content, str) else json.dumps(user_content, ensure_ascii=False)

    if "MEAL_VISION" in system or "נתח את הארוחה" in system:
        if "סלט" in text:
            return json.dumps({
                "description_he": "סלט ירקות עם טונה", "calories": 320, "protein_g": 25,
                "confidence": "high", "one_clarifying_question_or_null": None,
            }, ensure_ascii=False)
        if "פיצה" in text:
            return json.dumps({
                "description_he": "פיצה", "calories": 850, "protein_g": 30,
                "confidence": "medium",
                "one_clarifying_question_or_null": "כמה משולשים אכלת — 2 או יותר?",
            }, ensure_ascii=False)
        if "מרק" in text:
            return json.dumps({
                "description_he": "מרק לא מזוהה", "calories": 250, "protein_g": 8,
                "confidence": "low",
                "one_clarifying_question_or_null": "זה מרק עוף או מרק ירקות?",
            }, ensure_ascii=False)
        if "עוגה" in text or "בורגר" in text:
            return json.dumps({
                "description_he": "המבורגר עם צ'יפס", "calories": 1200, "protein_g": 40,
                "confidence": "high", "one_clarifying_question_or_null": None,
            }, ensure_ascii=False)
        if "MOCK_MEDIA" in text or "image" in text:
            return json.dumps({
                "description_he": "שניצל עם אורז וסלט", "calories": 650, "protein_g": 35,
                "confidence": "high", "one_clarifying_question_or_null": None,
            }, ensure_ascii=False)
        if "שניצל" in text:
            return json.dumps({
                "description_he": "שניצל עם אורז", "calories": 600, "protein_g": 35,
                "confidence": "high", "one_clarifying_question_or_null": None,
            }, ensure_ascii=False)
        # not food → chat
        return json.dumps({
            "description_he": "", "calories": None, "protein_g": None,
            "confidence": "low", "one_clarifying_question_or_null": None,
        }, ensure_ascii=False)

    if "DAY_PLANNER" in system or "תוכנית יום" in system:
        return json.dumps({
            "meals": [
                {"name": "יוגורט עם גרנולה ופרי", "calories": 300, "protein_g": 15},
                {"name": "שניצל עם סלט גדול", "calories": 600, "protein_g": 40},
                {"name": "כריך טונה", "calories": 350, "protein_g": 20},
                {"name": "גבינה לבנה עם ירקות", "calories": 250, "protein_g": 20},
            ],
            "total_calories": 1500,
            "note_he": "יום מאוזן, פשוט להכנה",
        }, ensure_ascii=False)

    if "WEEKLY_INSIGHT" in system or "סיכום שבועי" in system:
        return json.dumps({
            "insight_he": "רוב האכילה הרגשית שלך קורית בערב מול הטלוויזיה",
            "focus_he": "השבוע ננסה כוס מים לפני כל נשנוש ערב",
        }, ensure_ascii=False)

    # generic coach chat
    return "מעולה, אני איתך. ממשיכים לפי התוכנית 🙂"
