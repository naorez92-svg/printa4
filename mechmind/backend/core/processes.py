"""טעינת תהליכי ייצור + מודל עלות דטרמיניסטי."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@lru_cache(maxsize=1)
def load_processes() -> list[dict]:
    with open(DATA_DIR / "processes.json", encoding="utf-8") as f:
        return json.load(f)["processes"]


def estimate_cost(process: dict, material: dict, volume_cm3: float, quantity: int) -> dict:
    """אומדן עלות ליחידה ולסדרה. נוסחאות שקופות, כל מספר מהנתונים.

    מחזיר dict עם פירוק מלא של העלות כדי שהמשתמש יראה מאיפה כל שקל מגיע.
    """
    mass_kg = volume_cm3 * material["density_g_cm3"] / 1000.0
    # חומר גלם: מקדם 1.6 על נפח החלק (פחת חיתוך/שבבים)
    material_cost = mass_kg * 1.6 * material["price_ils_per_kg"]

    machining_min = 0.0
    process_cost = 0.0
    if "removal_rate_cm3_min_by_machinability" in process:
        rate_table = process["removal_rate_cm3_min_by_machinability"]
        mrr = rate_table[str(material["machinability"])]
        # מסירים כ-60% מנפח הבלוק הגולמי (אומדן שמרני)
        removed_cm3 = volume_cm3 * 0.6 + 5.0
        machining_min = removed_cm3 / mrr + process.get("handling_min_per_part", 0)
        process_cost = machining_min / 60.0 * process["machine_rate_ils_per_hr"]
    elif "cut_speed_mm_min" in process:  # פח
        # אומדן היקף חיתוך משטח פרוס: פרימטר ~ 4 × שורש שטח הפריסה
        sheet_area_mm2 = volume_cm3 * 1000.0 / 3.0  # הנחת עובי ממוצע 3 מ"מ
        perimeter_mm = 4.0 * (sheet_area_mm2 ** 0.5) * 1.5
        cut_min = perimeter_mm / process["cut_speed_mm_min"] + process.get("handling_min_per_part", 0)
        machining_min = cut_min
        process_cost = (cut_min / 60.0 * process["machine_rate_ils_per_hr"]
                        + 2 * process.get("cost_per_bend_ils", 0))
    elif "unit_cost_per_kg_ils" in process:  # יציקה / הזרקה
        process_cost = mass_kg * process["unit_cost_per_kg_ils"]
    elif "print_rate_cm3_hr" in process:  # הדפסה
        print_hr = volume_cm3 / process["print_rate_cm3_hr"]
        machining_min = print_hr * 60.0
        process_cost = print_hr * process["machine_rate_ils_per_hr"]

    setup_per_unit = process.get("setup_cost_ils", 0) / max(quantity, 1)
    tooling_per_unit = process.get("tooling_cost_ils", 0) / max(quantity, 1)
    unit_cost = material_cost + process_cost + setup_per_unit + tooling_per_unit

    return {
        "mass_kg": round(mass_kg, 3),
        "material_cost_ils": round(material_cost, 2),
        "process_cost_ils": round(process_cost, 2),
        "setup_per_unit_ils": round(setup_per_unit, 2),
        "tooling_per_unit_ils": round(tooling_per_unit, 2),
        "unit_cost_ils": round(unit_cost, 2),
        "total_cost_ils": round(unit_cost * quantity, 2),
        "cycle_time_min": round(machining_min, 1),
    }


def recommend_processes(material_class: str, geometry: str, quantity: int,
                        material: dict, volume_cm3: float) -> list[dict]:
    """מדרג תהליכים מתאימים לפי עלות ליחידה. דטרמיניסטי."""
    results = []
    for p in load_processes():
        if material_class not in p["suitable_classes"]:
            continue
        if geometry not in p["geometry"]:
            continue
        if not (p["min_qty"] <= quantity <= p["max_qty"]):
            continue
        cost = estimate_cost(p, material, volume_cm3, quantity)
        results.append({
            "process_id": p["id"],
            "name_he": p["name_he"],
            "tolerance_mm": p["tolerance_mm"],
            "dfm_notes_he": p["dfm_notes_he"],
            **cost,
        })
    results.sort(key=lambda r: r["unit_cost_ils"])
    return results
