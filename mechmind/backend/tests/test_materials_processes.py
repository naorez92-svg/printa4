"""בדיקות קטלוג חומרים, דירוג, ומודל עלות תהליכים."""
import pytest

from backend.core.materials import (find_material_by_name, get_material,
                                    load_materials, mass_from_volume, rank_materials)
from backend.core.processes import estimate_cost, load_processes, recommend_processes


def test_catalog_integrity():
    materials = load_materials()
    assert len(materials) >= 10
    required = {"id", "name_he", "class", "density_g_cm3", "yield_mpa",
                "elastic_modulus_gpa", "price_ils_per_kg", "corrosion_resistance",
                "max_service_temp_c", "machinability", "weldability", "notes_he"}
    for m in materials:
        assert required <= set(m.keys()), f"שדות חסרים ב-{m.get('id')}"
        assert m["density_g_cm3"] > 0 and m["yield_mpa"] > 0
        assert 1 <= m["corrosion_resistance"] <= 5
        assert 1 <= m["machinability"] <= 5


def test_find_material():
    assert get_material("al6061")["name_he"].startswith("אלומיניום")
    assert find_material_by_name("נירוסטה 304")["id"] == "ss304"
    assert find_material_by_name("AL6061")["id"] == "al6061"
    assert find_material_by_name("לא קיים בכלל") is None


def test_rank_filters_hard():
    # דרישת קורוזיה 5 → רק 316L, טיטניום, POM
    ranked = rank_materials(min_corrosion_resistance=5)
    ids = {m["id"] for m in ranked}
    assert ids == {"ss316l", "ti6al4v", "pom_c"}


def test_rank_prefer_weight_puts_light_first():
    ranked = rank_materials(min_yield_mpa=200, prefer="weight")
    assert ranked[0]["class"] in ("aluminum", "titanium")


def test_rank_empty_when_impossible():
    assert rank_materials(min_yield_mpa=2000) == []


def test_mass_from_volume():
    # 1000 mm³ פלדה = 1 cm³ × 7.85 = 7.85 גרם
    assert mass_from_volume(1000, "s235jr") == pytest.approx(7.85)
    assert mass_from_volume(1000, "no_such") is None


def test_processes_integrity():
    processes = load_processes()
    assert len(processes) >= 5
    for p in processes:
        assert p["min_qty"] <= p["max_qty"]
        assert p["dfm_notes_he"]


def test_recommend_axisymmetric_prefers_turning():
    material = get_material("c45")
    options = recommend_processes("steel", "axisymmetric", 20, material, 50)
    assert options
    assert options[0]["process_id"] == "cnc_turning"


def test_injection_only_for_large_qty_polymers():
    material = get_material("abs")
    small = recommend_processes("polymer", "complex", 5, material, 20)
    assert all(o["process_id"] != "injection_molding" for o in small)
    large = recommend_processes("polymer", "complex", 50000, material, 20)
    assert any(o["process_id"] == "injection_molding" for o in large)


def test_cost_scales_with_quantity():
    """עלות ליחידה יורדת עם הכמות (סטאפ מתחלק) — עקרון כלכלת ייצור בסיסי."""
    material = get_material("al6061")
    process = next(p for p in load_processes() if p["id"] == "cnc_milling")
    one = estimate_cost(process, material, 100, 1)
    hundred = estimate_cost(process, material, 100, 100)
    assert hundred["unit_cost_ils"] < one["unit_cost_ils"]
    assert one["unit_cost_ils"] > 0
    # פירוק העלות מסתכם לעלות היחידה
    for c in (one, hundred):
        parts = (c["material_cost_ils"] + c["process_cost_ils"]
                 + c["setup_per_unit_ils"] + c["tooling_per_unit_ils"])
        assert c["unit_cost_ils"] == pytest.approx(parts, abs=0.05)


def test_titanium_costs_more_than_steel():
    ti, steel = get_material("ti6al4v"), get_material("s235jr")
    process = next(p for p in load_processes() if p["id"] == "cnc_milling")
    assert (estimate_cost(process, ti, 100, 10)["unit_cost_ils"]
            > estimate_cost(process, steel, 100, 10)["unit_cost_ils"])
