"""M-06 · מתרגם לפרויקט — הופך תוצר טכני למשימות, אבני דרך, סיכונים ומפרט ספק.

ה-LLM מבנה את התוכן (טקסט, לא מספרים הנדסיים); היצוא ל-PDF דטרמיניסטי.
"""
from __future__ import annotations

import json
import uuid

from ..config import settings
from ..core.exports import export_pdf
from ..llm import complete, extract_json, text_of

_TRANSLATOR_SYSTEM = """אתה מנהל פרויקטים הנדסי (PMP). קיבלת תוצר טכני או תיאור של רכיב/מכלול.
תרגם אותו לתוכנית עבודה. החזר אך ורק JSON תקין במבנה:
{
  "project_name_he": "שם קצר",
  "tasks": [{"id": 1, "name_he": "...", "days": 3, "depends_on": [], "owner_role_he": "מהנדס/רכש/ספק/QA"}],
  "milestones_he": ["..."],
  "risks": [{"risk_he": "...", "mitigation_he": "..."}],
  "rfq_he": {
    "scope_he": "תיאור העבודה לספק",
    "deliverables_he": ["..."],
    "quality_requirements_he": ["דרישות איכות, תקנים, טולרנסים"],
    "info_needed_from_supplier_he": ["מה לבקש בהצעת המחיר"]
  }
}
חוקים: משימות קונקרטיות (5–12), ימים ריאליים, תלויות הגיוניות לפי id.
אל תמציא מחירים או מספרים הנדסיים — אלה לא בתחומך. כל הטקסט בעברית."""


def translate_to_project(source_description_he: str) -> dict:
    if not source_description_he.strip():
        return {"status": "error", "summary_he": "לא סופק תוכן לתרגום לפרויקט.",
                "data": {}, "artifacts": []}

    resp = complete(_TRANSLATOR_SYSTEM,
                    [{"role": "user", "content": source_description_he[:8000]}],
                    max_tokens=3000)
    plan = extract_json(text_of(resp))
    if not isinstance(plan, dict) or not plan.get("tasks"):
        return {"status": "error",
                "summary_he": "לא הצלחתי לבנות תוכנית פרויקט מהתוכן. נסה לתאר את התוצר ביתר פירוט.",
                "data": {}, "artifacts": []}

    tasks = _normalize_tasks(plan.get("tasks"))
    if not tasks:
        return {"status": "error",
                "summary_he": "התקבלה תוכנית לא תקינה מהמנוע. נסה שוב או תאר את התוצר ביתר פירוט.",
                "data": {}, "artifacts": []}
    plan["tasks"] = tasks
    start_days = _schedule(tasks)
    total_days = max((start_days[t["id"]] + t["days"] for t in tasks), default=0)

    job_id = uuid.uuid4().hex[:12]
    out_dir = settings.artifacts_path / f"project_{job_id}"
    out_dir.mkdir(parents=True, exist_ok=True)

    task_rows = [[t["id"], t["name_he"], t.get("owner_role_he", ""), t.get("days", 1),
                  f"יום {start_days[t['id']] + 1}",
                  ", ".join(map(str, t.get("depends_on") or [])) or "—"]
                 for t in tasks]
    rfq = plan.get("rfq_he") or {}
    sections = [
        {"heading": "לוח משימות",
         "table": {"headers": ["#", "משימה", "אחראי", "ימים", "התחלה", "תלוי ב"],
                   "rows": task_rows},
         "paragraphs": [f"משך כולל משוער: {total_days} ימי עבודה."]},
        {"heading": "אבני דרך", "bullets": plan.get("milestones_he") or []},
        {"heading": "סיכונים ומענה",
         "table": {"headers": ["סיכון", "מענה"],
                   "rows": [[r.get("risk_he", ""), r.get("mitigation_he", "")]
                            for r in plan.get("risks") or []]}},
        {"heading": "מפרט לספק (RFQ)",
         "paragraphs": [rfq.get("scope_he", "")],
         "bullets": [*(rfq.get("deliverables_he") or []),
                     *(rfq.get("quality_requirements_he") or [])]},
        {"heading": "לבקש מהספק בהצעת המחיר",
         "bullets": rfq.get("info_needed_from_supplier_he") or []},
    ]

    pdf_path = out_dir / "project_plan.pdf"
    export_pdf(plan.get("project_name_he", "תוכנית פרויקט"), sections, pdf_path)
    json_path = out_dir / "project_plan.json"
    json_path.write_text(json.dumps({**plan, "start_days": start_days,
                                     "total_days": total_days},
                                    ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "status": "ok",
        "summary_he": (f"תוכנית הפרויקט '{plan.get('project_name_he', '')}' נבנתה: "
                       f"{len(tasks)} משימות, {total_days} ימי עבודה, "
                       f"{len(plan.get('risks') or [])} סיכונים ממופים + מפרט RFQ לספק. "
                       "קובץ PDF מוכן להורדה."),
        "data": {**plan, "start_days": start_days, "total_days": total_days},
        "artifacts": [
            {"kind": "pdf", "filename": "project_plan.pdf",
             "path": str(pdf_path), "module": "M-06"},
            {"kind": "json", "filename": "project_plan.json",
             "path": str(json_path), "module": "M-06"},
        ],
    }


def _coerce_days(value) -> int:
    """ממיר משך משימה למספר ימים חיובי. תומך במחרוזות ('3', '2-3 ימים') ובטווחים."""
    if isinstance(value, (int, float)) and value > 0:
        return int(round(value))
    if isinstance(value, str):
        import re
        nums = re.findall(r"\d+", value)
        if nums:
            return max(1, max(int(n) for n in nums))
    return 1


def _normalize_tasks(raw) -> list[dict]:
    """מנקה תוכנית מ-LLM: מזהה שלם לכל משימה, ימים חיוביים, תלויות תקינות.
    לעולם לא זורק — משימה פגומה מדולגת. מחזיר [] אם אין ולו משימה תקינה אחת.
    """
    if not isinstance(raw, list):
        return []
    tasks = []
    used_ids: set[int] = set()
    for i, t in enumerate(raw, start=1):
        if not isinstance(t, dict):
            continue
        try:
            tid = int(t.get("id", i))
        except (TypeError, ValueError):
            tid = i
        while tid in used_ids:
            tid += 1000
        used_ids.add(tid)
        name = str(t.get("name_he") or t.get("name") or f"משימה {tid}")
        deps_raw = t.get("depends_on") or []
        deps = []
        if isinstance(deps_raw, list):
            for d in deps_raw:
                try:
                    deps.append(int(d))
                except (TypeError, ValueError):
                    continue
        tasks.append({"id": tid, "name_he": name, "days": _coerce_days(t.get("days", 1)),
                      "depends_on": deps, "owner_role_he": str(t.get("owner_role_he", ""))})
    return tasks


def _days_of(tasks_by_id: dict[int, dict], task_id: int) -> int:
    t = tasks_by_id.get(task_id)
    return int(t.get("days", 1)) if t else 0


def _schedule(tasks: list[dict]) -> dict[int, int]:
    """יום התחלה לכל משימה = הסיום המאוחר של תלויותיה. עמיד לתלויות
    שמופיעות בהמשך הרשימה (forward refs) ולמחזורים (מתעלם מקשת שסוגרת מחזור).
    """
    tasks_by_id = {t["id"]: t for t in tasks}
    start_days: dict[int, int] = {}
    resolving: set[int] = set()

    def start_of(task_id: int) -> int:
        if task_id in start_days:
            return start_days[task_id]
        t = tasks_by_id.get(task_id)
        if t is None or task_id in resolving:  # תלות חסרה או מחזור → יום 0
            return 0
        resolving.add(task_id)
        deps = t.get("depends_on") or []
        start = max((start_of(d) + _days_of(tasks_by_id, d) for d in deps), default=0)
        resolving.discard(task_id)
        start_days[task_id] = start
        return start

    for t in tasks:
        start_of(t["id"])
    return start_days
