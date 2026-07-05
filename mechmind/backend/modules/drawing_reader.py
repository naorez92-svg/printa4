"""M-05 · קורא שרטוטים — Claude multimodal מפרש שרטוט הנדסי לעברית.

עיקרון: מה שלא נראה בבירור — נאמר מפורשות שחסר. לא ממציאים מידות.
"""
from __future__ import annotations

import base64
import json
import uuid

from ..config import settings
from ..llm import complete, extract_json, text_of

_READER_SYSTEM = """אתה מהנדס מכונות מומחה בקריאת שרטוטים טכניים.
נתח את השרטוט והחזר אך ורק JSON תקין (בלי גדרות קוד) במבנה:
{
  "part_name_he": "שם החלק אם מופיע בכותרת, אחרת תיאור קצר",
  "views_he": ["רשימת המבטים שזוהו: מבט על, חתך A-A וכו'"],
  "dimensions": [{"label": "סימון/תיאור", "value": "הערך כפי שכתוב", "type": "אורך/קוטר/רדיוס/זווית/הברגה/טולרנס"}],
  "material_he": "החומר אם צוין בטבלת השרטוט, אחרת null",
  "general_tolerance_he": "טולרנס כללי אם צוין, אחרת null",
  "annotations_he": ["הערות, סימוני ריתוך, גימור שטח, טיפול תרמי"],
  "issues_he": ["סתירות, מידות חסרות, כיתובים לא קריאים — כל בעיה שמצאת"],
  "summary_he": "פסקת סיכום בעברית: מה החלק, איך מייצרים אותו, ומה חסר"
}

חוקים:
- כתוב אך ורק מה שאתה רואה בבירור. מידה מטושטשת או חתוכה → רשום אותה ב-issues_he, אל תנחש.
- אם התמונה אינה שרטוט הנדסי — החזר {"not_a_drawing": true, "summary_he": "הסבר קצר"}.
- כל הטקסט בעברית."""

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def read_drawing(file_bytes: bytes, mime_type: str,
                 user_note_he: str = "", session_id: int | None = None) -> dict:
    if mime_type not in ALLOWED_MIME:
        return {"status": "error",
                "summary_he": "פורמט לא נתמך. העלה JPG, PNG, WEBP, GIF או PDF.",
                "data": {}, "artifacts": []}
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        return {"status": "error",
                "summary_he": "הקובץ גדול מ-10MB. הקטן אותו ונסה שוב.",
                "data": {}, "artifacts": []}
    if not file_bytes:
        return {"status": "error", "summary_he": "הקובץ ריק.", "data": {}, "artifacts": []}

    b64 = base64.standard_b64encode(file_bytes).decode()
    block = ({"type": "document",
              "source": {"type": "base64", "media_type": "application/pdf", "data": b64}}
             if mime_type == "application/pdf" else
             {"type": "image",
              "source": {"type": "base64", "media_type": mime_type, "data": b64}})

    content = [block, {"type": "text",
                       "text": user_note_he or "נתח את השרטוט המצורף."}]
    resp = complete(_READER_SYSTEM, [{"role": "user", "content": content}], max_tokens=3000)
    parsed = extract_json(text_of(resp))

    if not isinstance(parsed, dict):
        return {"status": "error",
                "summary_he": "לא הצלחתי לפרש את השרטוט. ודא שהתמונה חדה ונסה שוב.",
                "data": {}, "artifacts": []}

    if parsed.get("not_a_drawing"):
        return {"status": "error",
                "summary_he": parsed.get("summary_he", "הקובץ אינו שרטוט הנדסי."),
                "data": parsed, "artifacts": []}

    # שמירת הפירוש כ-artifact JSON להמשך שרשור למודולים אחרים
    job_id = uuid.uuid4().hex[:12]
    out_dir = settings.artifacts_path / f"drawing_{job_id}"
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "interpretation.json"
    json_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")

    issues = parsed.get("issues_he") or []
    dims = parsed.get("dimensions") or []
    summary_parts = [parsed.get("summary_he", "")]
    if dims:
        summary_parts.append(f"זוהו {len(dims)} מידות.")
    if issues:
        summary_parts.append("⚠ בעיות שזוהו בשרטוט:\n" + "\n".join(f"• {i}" for i in issues))

    return {
        "status": "ok",
        "summary_he": "\n".join(p for p in summary_parts if p),
        "data": parsed,
        "artifacts": [{"kind": "json", "filename": "interpretation.json",
                       "path": str(json_path), "module": "M-05"}],
    }
