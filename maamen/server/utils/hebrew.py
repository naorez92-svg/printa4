"""Small Hebrew text parsing helpers."""
import re

YES_WORDS = {"כן", "כן.", "בטח", "ברור", "יס", "yes", "y", "כןן", "אכן", "נכון"}
NO_WORDS = {"לא", "לא.", "ממש לא", "no", "n", "שלילי"}


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def parse_yes_no(text: str) -> bool | None:
    t = normalize(text).lower().rstrip("!.")
    if t in YES_WORDS or t.startswith("כן"):
        return True
    if t in NO_WORDS or t.startswith("לא"):
        return False
    return None


def extract_number(text: str) -> float | None:
    m = re.search(r"\d+(?:[.,]\d+)?", text or "")
    if not m:
        return None
    return float(m.group(0).replace(",", "."))


def extract_time(text: str) -> tuple[int, int] | None:
    """Parse '08:00', '8:30', '7' → (hour, minute)."""
    t = normalize(text)
    m = re.search(r"(\d{1,2}):(\d{2})", t)
    if m:
        h, mi = int(m.group(1)), int(m.group(2))
        if 0 <= h < 24 and 0 <= mi < 60:
            return h, mi
    m = re.search(r"\b(\d{1,2})\b", t)
    if m:
        h = int(m.group(1))
        if 0 <= h < 24:
            return h, 0
    return None
