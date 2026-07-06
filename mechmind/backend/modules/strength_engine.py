"""M-02 · בדיקת שפיוּת חוזק — דטרמיניסטי לחלוטין.

ה-LLM (דרך ה-Orchestrator) רק ממפה שפה חופשית לפרמטרים של הפונקציה הזו.
כל מספר בתוצאה מגיע מ-backend.core.beam או מ-materials.json.
"""
from __future__ import annotations

from ..core import beam
from ..core.materials import resolve_material
from ..safety import FS_RED_FLAG, NEEDS_ENGINEER_MSG, SAFETY_LINE


def check_strength(
    element_type: str,          # beam_analytic / beam_custom
    case: str | None = None,    # למקרה אנליטי: simply_supported_point וכו'
    length_mm: float = 0,
    section_type: str = "rectangle",
    section_dims: dict | None = None,
    material_id: str = "",
    load_n: float | None = None,
    udl_n_per_mm: float | None = None,
    support_positions_mm: list[float] | None = None,
    point_loads: list[dict] | None = None,
    is_dynamic_load: bool = False,
    is_fatigue: bool = False,
    is_pressure_vessel: bool = False,
) -> dict:
    """מחזיר {status, summary_he, data}. תמיד כולל את קו הבטיחות."""
    # חוק ברזל: מקרים מחוץ לטווח → מהנדס, לא ניחוש
    if is_dynamic_load or is_fatigue or is_pressure_vessel:
        reason = ("עומס דינמי" if is_dynamic_load else
                  "עייפות" if is_fatigue else "כלי לחץ")
        return _needs_engineer(
            f"המקרה כולל {reason} — מחוץ לטווח החישוב הסטטי של MechMind. {NEEDS_ENGINEER_MSG}"
        )

    material = resolve_material(material_id)
    if material is None:
        return {"status": "error",
                "summary_he": f"חומר לא מוכר או רב-משמעי: '{material_id}'. ציין מזהה חומר מדויק מהקטלוג.",
                "data": {}, "safety_note_he": SAFETY_LINE}

    try:
        section = beam.build_section(section_type, section_dims or {})
        if element_type == "beam_analytic":
            if not case:
                raise beam.UnsupportedCase("חסר מקרה קורה (case)")
            result = beam.solve_beam(
                case, length_mm, load_n=load_n, udl_n_per_mm=udl_n_per_mm,
                elastic_modulus_mpa=material["elastic_modulus_gpa"] * 1000.0,
                inertia_mm4=section.inertia_mm4,
            )
        elif element_type == "beam_custom":
            # הפותר הנומרי מטפל אך ורק בכוחות מרוכזים. עומס מפורס שנשלח כאן
            # היה נבלע בשקט ומחזיר מקדם ביטחון לא-שמרני — לכן חוסמים במפורש.
            if udl_n_per_mm is not None:
                raise beam.UnsupportedCase(
                    "עומס מפורס אינו נתמך במצב 'קורה על תמיכות'. "
                    "השתמש במקרה אנליטי (simply_supported_udl) או פרק את העומס לכוחות מרוכזים"
                )
            result = beam.solve_beam_anastruct(
                length_mm, support_positions_mm or [], point_loads or [],
                elastic_modulus_mpa=material["elastic_modulus_gpa"] * 1000.0,
                inertia_mm4=section.inertia_mm4, area_mm2=section.area_mm2,
            )
        else:
            raise beam.UnsupportedCase(
                f"סוג אלמנט לא נתמך: {element_type}. נתמכים: קורה אנליטית, קורה על תמיכות."
            )
    except beam.UnsupportedCase as e:
        return _needs_engineer(f"{e}. {NEEDS_ENGINEER_MSG}")

    stress = beam.bending_stress_mpa(result.max_moment_nmm, section.section_modulus_mm3)
    fs = beam.safety_factor(material["yield_mpa"], stress)

    red_flag = fs < FS_RED_FLAG
    status = "needs_engineer" if red_flag else "ok"
    fs_display = round(fs, 2) if fs != float("inf") else None

    verdict = (
        f"🔴 מקדם הביטחון {fs_display} נמוך מ-{FS_RED_FLAG} — התכן גבולי או כושל. "
        f"נדרש מהנדס רשוי, אין להשתמש בתכן הזה."
        if red_flag else
        f"🟢 מקדם ביטחון {fs_display} — התכן סביר כאומדן ראשוני."
    )
    summary = (
        f"{result.case_he} · {section.description_he} · {material['name_he']}\n"
        f"מומנט מרבי: {result.max_moment_nmm:,.0f} N·mm · "
        f"מאמץ כפיפה מרבי: {stress:,.1f} MPa · "
        f"חוזק כניעה: {material['yield_mpa']} MPa\n"
        f"{verdict}\n\n{SAFETY_LINE}"
    )

    return {
        "status": status,
        "summary_he": summary,
        "safety_note_he": SAFETY_LINE,
        "data": {
            "case_he": result.case_he,
            "section_he": section.description_he,
            "material_he": material["name_he"],
            "max_moment_nmm": round(result.max_moment_nmm, 1),
            "max_shear_n": round(result.max_shear_n, 1),
            "max_bending_stress_mpa": round(stress, 2),
            "yield_strength_mpa": material["yield_mpa"],
            "safety_factor": fs_display,
            "max_deflection_mm": (round(result.max_deflection_mm, 3)
                                  if result.max_deflection_mm is not None else None),
            "red_flag": red_flag,
            "formulas": result.formulas,
        },
    }


def _needs_engineer(message: str) -> dict:
    return {
        "status": "needs_engineer",
        "summary_he": f"{message}\n\n{SAFETY_LINE}",
        "safety_note_he": SAFETY_LINE,
        "data": {"red_flag": True},
    }
