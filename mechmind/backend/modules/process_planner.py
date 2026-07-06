"""M-04 · מתכנן תהליך ייצור — התאמה ואומדן עלות בקוד; הערות DFM מהקטלוג + LLM."""
from __future__ import annotations

from ..core.materials import resolve_material
from ..core.processes import recommend_processes
from ..llm import LLMUnavailable, complete, text_of

_DFM_SYSTEM = (
    "אתה מהנדס ייצור. קיבלת תהליך ייצור מומלץ שכבר נבחר אלגוריתמית, וההקשר "
    "מהמשתמש. נסח משפט או שניים של המלצת DFM ממוקדת בעברית על בסיס הנתונים בלבד. "
    "אל תמציא מספרים, מחירים או זמנים. עד 60 מילים."
)


def plan_process(
    material_id: str,
    geometry: str,          # prismatic / axisymmetric / sheet / complex
    quantity: int,
    volume_cm3: float,
    context_he: str = "",
) -> dict:
    material = resolve_material(material_id)
    if material is None:
        return {"status": "error",
                "summary_he": f"חומר לא מוכר או רב-משמעי: '{material_id}'. ציין מזהה חומר מדויק מהקטלוג.",
                "data": {}}
    if quantity < 1 or volume_cm3 <= 0:
        return {"status": "error",
                "summary_he": "כמות ונפח חייבים להיות חיוביים.", "data": {}}

    geometry_names = {"prismatic": "פריזמטית", "axisymmetric": "סיבובית",
                      "sheet": "פח", "complex": "מורכבת"}
    if geometry not in geometry_names:
        return {"status": "error",
                "summary_he": f"גאומטריה לא מוכרת: '{geometry}'. "
                              "האפשרויות: prismatic / axisymmetric / sheet / complex.",
                "data": {}}

    options = recommend_processes(material["class"], geometry, quantity, material, volume_cm3)
    if not options:
        return {
            "status": "needs_engineer",
            "summary_he": (f"לא נמצא תהליך מתאים ל{material['name_he']} "
                           f"בגאומטריה {geometry_names[geometry]} בכמות {quantity:,}. "
                           "ייתכן שהכמות מחוץ לטווח הכלכלי של התהליכים בקטלוג — "
                           "התייעץ עם מהנדס ייצור."),
            "data": {"options": []},
        }

    best = options[0]
    lines = [
        f"תהליך מומלץ: {best['name_he']}",
        f"עלות ליחידה: ‏{best['unit_cost_ils']:,} ₪ · "
        f"סה\"כ לסדרה של {quantity:,}: ‏{best['total_cost_ils']:,} ₪",
        f"(חומר {best['material_cost_ils']:,} ₪ + עיבוד {best['process_cost_ils']:,} ₪ + "
        f"סטאפ {best['setup_per_unit_ils']:,} ₪ + תבנית {best['tooling_per_unit_ils']:,} ₪ ליחידה)",
        f"זמן מחזור משוער: {best['cycle_time_min']} דק' · דיוק טיפוסי: ±{best['tolerance_mm']} מ\"מ",
        "",
        "הערות DFM (תכן לייצור):",
        *[f"• {n}" for n in best["dfm_notes_he"]],
    ]
    if len(options) > 1:
        alt = options[1]
        lines.append("")
        lines.append(f"חלופה: {alt['name_he']} — ‏{alt['unit_cost_ils']:,} ₪ ליחידה.")

    # משוב DFM מותאם-הקשר מה-LLM (אופציונלי — הכל עובד גם בלי מפתח API)
    dfm_llm = ""
    if context_he.strip():
        try:
            resp = complete(_DFM_SYSTEM, [{"role": "user", "content":
                f"הקשר: {context_he}\nתהליך: {best['name_he']} · חומר: {material['name_he']} · "
                f"גאומטריה: {geometry_names[geometry]} · כמות: {quantity}"}], max_tokens=300)
            dfm_llm = text_of(resp).strip()
            if dfm_llm:
                lines += ["", f"המלצת DFM ממוקדת: {dfm_llm}"]
        except LLMUnavailable:
            pass

    return {
        "status": "ok",
        "summary_he": "\n".join(lines),
        "data": {"recommended": best, "options": options, "dfm_note_he": dfm_llm,
                 "material_he": material["name_he"], "quantity": quantity},
    }
