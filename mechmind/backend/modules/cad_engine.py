"""M-01 · סטודיו שרטוט וכתב כמויות.

ה-LLM ממיר תיאור חופשי לסקריפט CadQuery בלבד. הסקריפט עובר ולידציית AST,
רץ ב-sandbox מבודד, והנפח/מסה מחושבים מ-OCC + materials.json — לא מה-LLM.
"""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

from ..config import settings
from ..core.materials import find_material_by_name, get_material, load_materials
from ..core.sandbox import ScriptRejected, run_cadquery_script
from ..llm import complete, extract_json, text_of
from .bom_builder import build_bom

_CAD_SYSTEM = """אתה מהנדס תכן שממיר תיאור בעברית לסקריפט CadQuery (Python) בלבד.

חוקים קשיחים:
1. החזר אך ורק קוד Python, בלי שום טקסט לפניו או אחריו, בלי גדרות ```.
2. השורה הראשונה תמיד: import cadquery as cq  (מותר גם import math ותו לא).
3. הגדר את כל המידות כמשתנים בראש הסקריפט (במ"מ), עם הערה בעברית ליד כל אחד.
4. המודל הסופי חייב להיות במשתנה בשם result (cq.Workplane עם גוף מוצק).
5. אסור: קבצים, רשת, exec/eval, getattr, מחלקות, לולאות אינסופיות.
6. אם חסרה מידה קריטית שאי-אפשר להסיק — החזר במקום קוד אך ורק JSON בצורה:
   {"need": ["<תיאור המידה החסרה בעברית>", ...]}
   לעולם אל תמציא מידות שלא נמסרו ולא ניתנות להסקה סבירה.
7. שמור על גאומטריה פשוטה ונכונה: box, cylinder, hole, fillet, chamfer, extrude, cut.
"""


def _strip_code(text: str) -> str:
    text = text.strip()
    # מסיר גדר קוד עם כל תגית שפה (```python / ```json / ```)
    fence = re.search(r"```[a-zA-Z]*\n?(.*?)```", text, re.DOTALL)
    return fence.group(1).strip() if fence else text


def generate_cad(description_he: str, material_id: str = "al6061",
                 quantity: int = 1, session_id: int | None = None) -> dict:
    """מחזיר {status, summary_he, data, artifacts[]}."""
    material = get_material(material_id) or find_material_by_name(material_id)
    if material is None:
        names = ", ".join(m["id"] for m in load_materials())
        return {"status": "error",
                "summary_he": f"חומר לא מוכר: '{material_id}'. האפשרויות: {names}",
                "data": {}, "artifacts": []}

    resp = complete(_CAD_SYSTEM,
                    [{"role": "user", "content": description_he}], max_tokens=3000)
    raw = text_of(resp)
    code = _strip_code(raw)

    # ה-LLM מבקש מידות חסרות במקום להמציא
    if code.lstrip().startswith("{"):
        parsed = extract_json(code)
        if isinstance(parsed, dict) and parsed.get("need"):
            needs = "\n".join(f"• {n}" for n in parsed["need"])
            return {"status": "error",
                    "summary_he": f"כדי לבנות את המודל חסרות המידות הבאות:\n{needs}\n"
                                  "ציין אותן ונסה שוב.",
                    "data": {"need": parsed["need"]}, "artifacts": []}

    job_id = uuid.uuid4().hex[:12]
    out_dir = settings.artifacts_path / f"cad_{job_id}"

    try:
        result = run_cadquery_script(code, out_dir)
    except ScriptRejected as e:
        return {"status": "error",
                "summary_he": f"הסקריפט שנוצר נפסל מטעמי בטיחות: {e}. נסח את הבקשה מחדש.",
                "data": {}, "artifacts": []}
    if not result.get("ok"):
        return {"status": "error", "summary_he": result.get("error_he", "כשל בבניית המודל"),
                "data": {}, "artifacts": []}

    volume_mm3 = result["volume_mm3"]
    mass_g = round(volume_mm3 / 1000.0 * material["density_g_cm3"], 1)

    bom = build_bom(
        [{"name": description_he[:80], "material_id": material["id"],
          "volume_mm3": volume_mm3, "qty": quantity}],
        out_dir, title="כתב כמויות — " + description_he[:40],
    )

    (out_dir / "script.py").write_text(code, encoding="utf-8")

    artifacts = []
    kind_map = {"step": "step", "dxf": "dxf", "svg": "svg"}
    for key, fname in result["files"].items():
        artifacts.append({"kind": kind_map.get(key, key), "filename": fname,
                          "path": str(out_dir / fname), "module": "M-01"})
    artifacts.append({"kind": "xlsx", "filename": "bom.xlsx",
                      "path": bom["xlsx_path"], "module": "M-01"})

    bb = result["bounding_box_mm"]
    summary = (
        f"המודל נבנה בהצלחה ✔\n"
        f"ממדים כוללים: {bb['x']}×{bb['y']}×{bb['z']} מ\"מ · "
        f"נפח: {volume_mm3 / 1000.0:,.1f} סמ\"ק · "
        f"מסה ({material['name_he']}): {mass_g:,.1f} גרם\n"
        f"נוצרו: STEP, DXF, תצוגה מקדימה, וכתב כמויות Excel."
    )
    return {
        "status": "ok",
        "summary_he": summary,
        "data": {"volume_mm3": volume_mm3, "mass_g": mass_g,
                 "bounding_box_mm": bb, "material_he": material["name_he"],
                 "bom_rows": bom["rows"], "script": code},
        "artifacts": artifacts,
    }
