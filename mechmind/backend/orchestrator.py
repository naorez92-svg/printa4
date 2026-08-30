"""ה-Orchestrator — סעיף 9 במסמך האב.

Claude מקבל את המודולים ככלים (tool-calling) ובוחר מה להריץ. ההרצה עצמה
דטרמיניסטית בקוד. אם כלי חוזק החזיר needs_engineer — קו הבטיחות והדגל האדום
נאכפים בקוד על התשובה הסופית, לא תלויים ברצון הטוב של המודל.
"""
from __future__ import annotations

import json

from .llm import complete, text_of
from .modules.cad_engine import generate_cad
from .modules.material_advisor import advise_material
from .modules.process_planner import plan_process
from .modules.project_translator import translate_to_project
from .modules.strength_engine import check_strength
from .safety import SAFETY_LINE

MAX_TOOL_ROUNDS = 6

_ORCHESTRATOR_SYSTEM = """אתה MechMind — "מהנדס-העל": עוזר הנדסת מכונות למהנדסי תעשייה וניהול ומנהלי פרויקטים.

יש לך כלים דטרמיניסטיים. חוקים קשיחים:
1. כל מספר הנדסי (מאמץ, מקדם ביטחון, מסה, נפח, עלות) חייב להגיע מכלי. לעולם אל תמציא מספר. אין כלי מתאים? אמור "לא ניתן לחשב, נדרש מהנדס".
2. תוצאת חוזק עם needs_engineer או red_flag — חובה להציג את הדגל האדום ואת אזהרת הבטיחות במלואה.
3. ענה תמיד בעברית, תמציתי ומקצועי. הפנה את המשתמש לקבצים שנוצרו (STEP/DXF/PDF/Excel) — הם מופיעים אצלו בקנבס התוצרים.
4. חסרים נתונים להפעלת כלי? שאל את המשתמש במקום לנחש.
5. אל תבטיח יכולות שאין לך: אתה עוזר תכן ראשוני, לא תחליף למהנדס רשוי.
6. בבדיקת חוזק — אם המשתמש מזכיר עומס מחזורי/דינמי/הלם/רטט/עייפות או לחץ/כלי לחץ, חובה להעביר את הדגל המתאים (is_dynamic_load / is_fatigue / is_pressure_vessel = true). אל תריץ חישוב סטטי על מקרה כזה.
7. השתמש במזהה חומר מדויק מהקטלוג. אם המשתמש נתן שם עמום ('פלדה', 'אלומיניום') — שאל איזה חומר ספציפי, אל תנחש.

קטלוג חומרים (material_id): s235jr, s355j2, c45, 42crmo4, ss304, ss316l, al6061, al7075, al5083, brass_cw614n, ti6al4v, pom_c, pa6, abs, pla."""

_SECTION_DIMS_SCHEMA = {
    "type": "object",
    "description": "מידות החתך במ\"מ לפי הסוג: rectangle→width_mm,height_mm · circle→diameter_mm · tube→outer_diameter_mm,wall_mm · box→width_mm,height_mm,wall_mm",
    "properties": {
        "width_mm": {"type": "number"}, "height_mm": {"type": "number"},
        "diameter_mm": {"type": "number"}, "outer_diameter_mm": {"type": "number"},
        "wall_mm": {"type": "number"},
    },
}

TOOLS = [
    {
        "name": "generate_cad",
        "description": "M-01: בונה מודל תלת-ממד מתיאור בעברית ומייצא STEP, DXF, תצוגה מקדימה וכתב כמויות Excel. השתמש כשהמשתמש מבקש שרטוט/מודל/חלק.",
        "input_schema": {
            "type": "object",
            "properties": {
                "description_he": {"type": "string", "description": "תיאור מלא של החלק בעברית כולל כל המידות שנמסרו"},
                "material_id": {"type": "string", "description": "מזהה חומר מהקטלוג. ברירת מחדל al6061"},
                "quantity": {"type": "integer", "minimum": 1, "default": 1},
            },
            "required": ["description_he"],
        },
    },
    {
        "name": "check_strength",
        "description": "M-02: בדיקת שפיות חוזק לקורה — מחשב מומנט, מאמץ, מקדם ביטחון ושקיעה. השתמש לכל שאלת 'יחזיק/לא יחזיק', עומס או חוזק.",
        "input_schema": {
            "type": "object",
            "properties": {
                "element_type": {"type": "string", "enum": ["beam_analytic", "beam_custom"],
                                 "description": "beam_analytic למקרה קלאסי; beam_custom לתמיכות/עומסים במיקומים שרירותיים"},
                "case": {"type": "string",
                         "enum": ["simply_supported_point", "simply_supported_udl",
                                  "cantilever_point", "cantilever_udl"],
                         "description": "נדרש עבור beam_analytic"},
                "length_mm": {"type": "number"},
                "section_type": {"type": "string", "enum": ["rectangle", "circle", "tube", "box"]},
                "section_dims": _SECTION_DIMS_SCHEMA,
                "material_id": {"type": "string"},
                "load_n": {"type": "number", "description": "כוח מרוכז בניוטון (למקרי point)"},
                "udl_n_per_mm": {"type": "number", "description": "עומס מפורס ב-N למ\"מ (למקרי udl)"},
                "support_positions_mm": {"type": "array", "items": {"type": "number"},
                                         "description": "ל-beam_custom: מיקומי שתי התמיכות"},
                "point_loads": {"type": "array",
                                "items": {"type": "object",
                                          "properties": {"position_mm": {"type": "number"},
                                                         "force_n": {"type": "number"}},
                                          "required": ["position_mm", "force_n"]},
                                "description": "ל-beam_custom: כוחות מרוכזים"},
                "is_dynamic_load": {"type": "boolean", "description": "עומס דינמי/הלם?"},
                "is_fatigue": {"type": "boolean", "description": "עומס מחזורי/עייפות?"},
                "is_pressure_vessel": {"type": "boolean", "description": "כלי לחץ?"},
            },
            "required": ["element_type", "length_mm", "section_type", "section_dims", "material_id"],
        },
    },
    {
        "name": "advise_material",
        "description": "M-03: ממליץ על חומרים לפי דרישות — מסנן ומדרג מקטלוג אמיתי. השתמש לכל שאלת 'איזה חומר'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "min_yield_mpa": {"type": "number"},
                "max_density_g_cm3": {"type": "number"},
                "min_corrosion_resistance": {"type": "integer", "minimum": 1, "maximum": 5,
                                             "description": "5=סביבה ימית/כימית, 4=חוץ, 1=פנים יבש"},
                "min_service_temp_c": {"type": "number"},
                "max_price_ils_per_kg": {"type": "number"},
                "prefer": {"type": "string",
                           "enum": ["balanced", "strength", "weight", "cost", "corrosion"]},
                "classes": {"type": "array", "items": {"type": "string",
                            "enum": ["steel", "stainless", "aluminum", "copper", "titanium", "polymer"]}},
                "context_he": {"type": "string", "description": "תקציר הצורך של המשתמש בעברית"},
            },
        },
    },
    {
        "name": "plan_process",
        "description": "M-04: ממליץ על תהליך ייצור עם אומדן עלות וזמן והערות DFM. השתמש לשאלות 'איך מייצרים/כמה יעלה'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "material_id": {"type": "string"},
                "geometry": {"type": "string", "enum": ["prismatic", "axisymmetric", "sheet", "complex"],
                             "description": "prismatic=מקוביה, axisymmetric=סיבובי, sheet=פח, complex=מורכב"},
                "quantity": {"type": "integer", "minimum": 1},
                "volume_cm3": {"type": "number", "description": "נפח החלק בסמ\"ק (מ-CAD אם קיים)"},
                "context_he": {"type": "string"},
            },
            "required": ["material_id", "geometry", "quantity", "volume_cm3"],
        },
    },
    {
        "name": "translate_to_project",
        "description": "M-06: הופך תוצר טכני לתוכנית פרויקט — משימות, אבני דרך, סיכונים ומפרט RFQ לספק, כולל PDF. השתמש כשמבקשים תוכנית/משימות/מפרט לספק.",
        "input_schema": {
            "type": "object",
            "properties": {
                "source_description_he": {"type": "string",
                                          "description": "התוצר/ההקשר המלא לתרגום לתוכנית — כלול את כל הפרטים הטכניים הידועים"},
            },
            "required": ["source_description_he"],
        },
    },
]

_TOOL_IMPL = {
    "generate_cad": generate_cad,
    "check_strength": check_strength,
    "advise_material": advise_material,
    "plan_process": plan_process,
    "translate_to_project": translate_to_project,
}


def run_chat(history: list[dict], user_message: str) -> dict:
    """מריץ סבב שיחה מלא. מחזיר {reply_he, artifacts[], jobs[]}."""
    messages = [*history, {"role": "user", "content": user_message}]
    collected_artifacts: list[dict] = []
    jobs: list[dict] = []
    needs_engineer = False

    for _ in range(MAX_TOOL_ROUNDS):
        response = complete(_ORCHESTRATOR_SYSTEM, messages, max_tokens=4096, tools=TOOLS)

        if response.stop_reason != "tool_use":
            reply = text_of(response).strip()
            break

        tool_results = []
        for block in response.content:
            if getattr(block, "type", "") != "tool_use":
                continue
            impl = _TOOL_IMPL.get(block.name)
            if impl is None:
                result = {"status": "error", "summary_he": f"כלי לא קיים: {block.name}"}
            else:
                try:
                    result = impl(**block.input)
                except TypeError as e:
                    result = {"status": "error",
                              "summary_he": f"פרמטרים שגויים לכלי {block.name}: {e}"}
                except Exception as e:  # כלי שנפל לא מפיל את השיחה
                    result = {"status": "error",
                              "summary_he": f"שגיאה בהרצת {block.name}: {e}"}

            jobs.append({"module": _module_of(block.name),
                         "status": result.get("status", "error"),
                         "summary": result.get("summary_he", "")[:500]})
            collected_artifacts.extend(result.get("artifacts") or [])
            # דגל 'נדרש מהנדס' נאסף מ-כל כלי (לא רק חוזק) — גם M-03/M-04
            # יכולים להחזיר needs_engineer, וחובה להציף אותו למשתמש.
            if (result.get("status") == "needs_engineer"
                    or result.get("data", {}).get("red_flag")):
                needs_engineer = True

            payload = {k: v for k, v in result.items() if k != "artifacts"}
            if result.get("artifacts"):
                payload["files_created"] = [a["filename"] for a in result["artifacts"]]
            tool_results.append({"type": "tool_result", "tool_use_id": block.id,
                                 "content": json.dumps(payload, ensure_ascii=False,
                                                       default=str)[:12000]})

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})
    else:
        reply = "העיבוד מורכב מדי לסבב אחד — פצל את הבקשה לשלבים קטנים יותר."

    # אכיפת קו הבטיחות בקוד — לא סומכים על ניסוח המודל.
    # בודקים נוכחות של הקו *המלא* (לא תחילית) — מודל שמצטט חצי מהאזהרה
    # לא ימנע את הוספת הקו השלם.
    used_strength = any(j["module"] == "M-02" for j in jobs)
    if used_strength and SAFETY_LINE not in reply:
        reply = f"{reply}\n\n{SAFETY_LINE}"
    if needs_engineer and "🔴" not in reply:
        reply = f"🔴 שים לב: אחד מהכלים סימן שהמקרה דורש מהנדס רשוי.\n\n{reply}"

    return {"reply_he": reply, "artifacts": collected_artifacts, "jobs": jobs,
            "needs_engineer": needs_engineer}


def _module_of(tool_name: str) -> str:
    return {"generate_cad": "M-01", "check_strength": "M-02", "advise_material": "M-03",
            "plan_process": "M-04", "translate_to_project": "M-06"}.get(tool_name, "M-00")
