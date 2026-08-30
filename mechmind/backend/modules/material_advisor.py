"""M-03 · יועץ חומרים — הסינון והדירוג בקוד; ה-LLM (אם זמין) רק מנסח הסבר."""
from __future__ import annotations

from ..core.materials import rank_materials
from ..llm import LLMUnavailable, complete, text_of

_ADVISOR_SYSTEM = (
    "אתה יועץ חומרים הנדסי. קיבלת רשימת חומרים שכבר סוננו ודורגו על-ידי אלגוריתם "
    "דטרמיניסטי לפי דרישות המשתמש. תפקידך אך ורק לנסח בעברית הסבר קצר וטרייד-אוף "
    "בין החלופות, על בסיס הנתונים שסופקו בלבד. אל תמציא מספרים ואל תוסיף חומרים. "
    "עד 120 מילים."
)


def advise_material(
    min_yield_mpa: float = 0,
    max_density_g_cm3: float | None = None,
    min_corrosion_resistance: int = 1,
    min_service_temp_c: float | None = None,
    max_price_ils_per_kg: float | None = None,
    prefer: str = "balanced",
    classes: list[str] | None = None,
    context_he: str = "",
) -> dict:
    ranked = rank_materials(
        min_yield_mpa=min_yield_mpa, max_density_g_cm3=max_density_g_cm3,
        min_corrosion_resistance=min_corrosion_resistance,
        min_service_temp_c=min_service_temp_c,
        max_price_ils_per_kg=max_price_ils_per_kg, prefer=prefer, classes=classes,
    )
    if not ranked:
        return {
            "status": "needs_engineer",
            "summary_he": ("אף חומר בקטלוג לא עומד בכל הדרישות יחד. "
                           "שקול להקל דרישה אחת (למשל מחיר או צפיפות), "
                           "או התייעץ עם מהנדס חומרים לחלופות מיוחדות."),
            "data": {"candidates": []},
        }

    top3 = ranked[:3]
    # הסבר דטרמיניסטי — עובד גם בלי מפתח API
    lines = []
    for i, m in enumerate(top3, start=1):
        lines.append(
            f"{i}. {m['name_he']} — כניעה {m['yield_mpa']} MPa, "
            f"צפיפות {m['density_g_cm3']} g/cm³, ‏{m['price_ils_per_kg']} ₪/ק\"ג, "
            f"קורוזיה {m['corrosion_resistance']}/5. {m['notes_he']}"
        )
    explanation = "\n".join(lines)

    try:
        data_str = "\n".join(
            f"- {m['name_he']}: כניעה {m['yield_mpa']} MPa, צפיפות {m['density_g_cm3']}, "
            f"מחיר {m['price_ils_per_kg']} ₪/ק\"ג, קורוזיה {m['corrosion_resistance']}/5, "
            f"עיבודיות {m['machinability']}/5, ריתוך {m['weldability']}/5. {m['notes_he']}"
            for m in top3
        )
        resp = complete(
            _ADVISOR_SYSTEM,
            [{"role": "user", "content":
              f"הקשר מהמשתמש: {context_he or 'לא סופק'}\n\nהחלופות המדורגות:\n{data_str}"}],
            max_tokens=600,
        )
        llm_text = text_of(resp).strip()
        if llm_text:
            explanation = f"{llm_text}\n\nנתוני מפתח:\n{explanation}"
    except LLMUnavailable:
        pass  # ההסבר הדטרמיניסטי מספיק

    return {
        "status": "ok",
        "summary_he": f"נמצאו {len(ranked)} חומרים מתאימים. שלוש החלופות המובילות:\n{explanation}",
        "data": {"candidates": top3, "total_matches": len(ranked)},
    }
