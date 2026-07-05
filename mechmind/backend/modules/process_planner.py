"""M-04 · מתכנן תהליך ייצור — התאמה ואומדן עלות בקוד; הערות DFM מהקטלוג + LLM."""
from __future__ import annotations

from ..core.materials import find_material_by_name, get_material
from ..core.processes import recommend_processes


def plan_process(
    material_id: str,
    geometry: str,          # prismatic / axisymmetric / sheet / complex
    quantity: int,
    volume_cm3: float,
    context_he: str = "",
) -> dict:
    material = get_material(material_id) or find_material_by_name(material_id)
    if material is None:
        return {"status": "error",
                "summary_he": f"חומר לא מוכר: '{material_id}'. בחר חומר מהקטלוג.",
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

    return {
        "status": "ok",
        "summary_he": "\n".join(lines),
        "data": {"recommended": best, "options": options,
                 "material_he": material["name_he"], "quantity": quantity},
    }
