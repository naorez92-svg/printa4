"""בניית כתב כמויות — המסה והעלות מחושבות מנפח CAD וצפיפות מהטבלה. לא LLM."""
from __future__ import annotations

from pathlib import Path

from ..core.exports import export_bom_xlsx
from ..core.materials import get_material


def build_bom(parts: list[dict], out_dir: str | Path, title: str = "כתב כמויות") -> dict:
    """parts: [{name, material_id, volume_mm3, qty, notes}]

    מחזיר rows + נתיב קובץ Excel. עלות ליחידה = מסה × מחיר לק"ג × 1.6 (פחת גלם).
    """
    rows = []
    for i, p in enumerate(parts, start=1):
        material = get_material(p.get("material_id", ""))
        mass_g = unit_cost = None
        material_name = p.get("material_id", "לא צוין")
        if material and p.get("volume_mm3"):
            mass_g = round(p["volume_mm3"] / 1000.0 * material["density_g_cm3"], 1)
            unit_cost = round(mass_g / 1000.0 * 1.6 * material["price_ils_per_kg"], 2)
            material_name = material["name_he"]
        rows.append({
            "item": i,
            "name": p.get("name", f"חלק {i}"),
            "material": material_name,
            "qty": int(p.get("qty", 1)),
            "mass_g": mass_g,
            "unit_cost_ils": unit_cost,
            "notes": p.get("notes", ""),
        })

    xlsx_path = Path(out_dir) / "bom.xlsx"
    export_bom_xlsx(rows, xlsx_path, title=title)
    return {"rows": rows, "xlsx_path": str(xlsx_path)}
