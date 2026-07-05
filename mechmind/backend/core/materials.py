"""טעינת ושאילתת נתוני חומרים — הסינון והדירוג דטרמיניסטיים לחלוטין."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@lru_cache(maxsize=1)
def load_materials() -> list[dict]:
    with open(DATA_DIR / "materials.json", encoding="utf-8") as f:
        return json.load(f)["materials"]


def get_material(material_id: str) -> dict | None:
    return next((m for m in load_materials() if m["id"] == material_id), None)


def find_material_by_name(name: str) -> dict | None:
    """חיפוש גמיש לפי שם עברי/אנגלי/מזהה."""
    name_l = name.strip().lower()
    for m in load_materials():
        if name_l in (m["id"].lower(), m["name_he"].lower(), m["name_en"].lower()):
            return m
    for m in load_materials():
        if name_l in m["name_he"].lower() or name_l in m["name_en"].lower():
            return m
    return None


def rank_materials(
    min_yield_mpa: float = 0,
    max_density_g_cm3: float | None = None,
    min_corrosion_resistance: int = 1,
    min_service_temp_c: float | None = None,
    max_price_ils_per_kg: float | None = None,
    prefer: str = "balanced",  # balanced / strength / weight / cost / corrosion
    classes: list[str] | None = None,
) -> list[dict]:
    """סינון קשיח לפי דרישות + דירוג משוקלל. מחזיר את כל העומדים בדרישות, מדורגים."""
    candidates = []
    for m in load_materials():
        if m["yield_mpa"] < min_yield_mpa:
            continue
        if max_density_g_cm3 is not None and m["density_g_cm3"] > max_density_g_cm3:
            continue
        if m["corrosion_resistance"] < min_corrosion_resistance:
            continue
        if min_service_temp_c is not None and m["max_service_temp_c"] < min_service_temp_c:
            continue
        if max_price_ils_per_kg is not None and m["price_ils_per_kg"] > max_price_ils_per_kg:
            continue
        if classes and m["class"] not in classes:
            continue
        candidates.append(m)

    if not candidates:
        return []

    weights = {
        "balanced": {"strength": 1.0, "weight": 1.0, "cost": 1.0, "corrosion": 0.5},
        "strength": {"strength": 3.0, "weight": 0.5, "cost": 0.5, "corrosion": 0.3},
        "weight": {"strength": 0.8, "weight": 3.0, "cost": 0.5, "corrosion": 0.3},
        "cost": {"strength": 0.5, "weight": 0.3, "cost": 3.0, "corrosion": 0.3},
        "corrosion": {"strength": 0.5, "weight": 0.5, "cost": 0.5, "corrosion": 3.0},
    }.get(prefer) or {"strength": 1.0, "weight": 1.0, "cost": 1.0, "corrosion": 0.5}

    max_yield = max(m["yield_mpa"] for m in candidates)
    max_price = max(m["price_ils_per_kg"] for m in candidates)
    max_density = max(m["density_g_cm3"] for m in candidates)

    scored = []
    for m in candidates:
        specific_strength = m["yield_mpa"] / m["density_g_cm3"]
        score = (
            weights["strength"] * (m["yield_mpa"] / max_yield)
            + weights["weight"] * (specific_strength / (max_yield / min(x["density_g_cm3"] for x in candidates)))
            + weights["cost"] * (1.0 - m["price_ils_per_kg"] / (max_price * 1.05))
            + weights["corrosion"] * (m["corrosion_resistance"] / 5.0)
        )
        scored.append({**m, "score": round(score, 3),
                       "specific_strength": round(specific_strength, 1)})
    scored.sort(key=lambda m: m["score"], reverse=True)
    return scored


def mass_from_volume(volume_mm3: float, material_id: str) -> float | None:
    """מסה בגרמים מנפח במ\"מ³ לפי צפיפות מהטבלה. מחושב בקוד, לא ב-LLM."""
    m = get_material(material_id)
    if m is None or volume_mm3 < 0:
        return None
    return volume_mm3 / 1000.0 * m["density_g_cm3"]  # mm³→cm³ → גרם
