"""M-02 — הדגלים, קו הבטיחות, וסטטוסים."""
from backend.modules.strength_engine import check_strength
from backend.safety import SAFETY_LINE


def _base(**over):
    params = dict(element_type="beam_analytic", case="simply_supported_point",
                  length_mm=1000, section_type="rectangle",
                  section_dims={"width_mm": 20, "height_mm": 40},
                  material_id="s235jr", load_n=1000)
    params.update(over)
    return params


def test_ok_case_has_safety_line_and_numbers():
    r = check_strength(**_base())
    assert r["status"] == "ok"
    assert SAFETY_LINE in r["summary_he"]
    assert r["data"]["safety_factor"] == 5.01
    assert r["data"]["max_bending_stress_mpa"] == 46.87 or \
           abs(r["data"]["max_bending_stress_mpa"] - 46.88) < 0.02
    assert not r["data"]["red_flag"]


def test_low_fs_red_flag():
    r = check_strength(**_base(load_n=30000))  # מאמץ ~1406 MPa → FS ~0.17
    assert r["status"] == "needs_engineer"
    assert r["data"]["red_flag"]
    assert "🔴" in r["summary_he"]
    assert SAFETY_LINE in r["summary_he"]


def test_dynamic_load_needs_engineer():
    r = check_strength(**_base(is_dynamic_load=True))
    assert r["status"] == "needs_engineer"
    assert "דינמי" in r["summary_he"]


def test_fatigue_needs_engineer():
    assert check_strength(**_base(is_fatigue=True))["status"] == "needs_engineer"


def test_pressure_needs_engineer():
    assert check_strength(**_base(is_pressure_vessel=True))["status"] == "needs_engineer"


def test_unknown_material():
    r = check_strength(**_base(material_id="unobtainium"))
    assert r["status"] == "error"


def test_material_by_hebrew_name():
    r = check_strength(**_base(material_id="נירוסטה 304"))
    assert r["status"] in ("ok", "needs_engineer")
    assert "304" in r["data"]["material_he"]


def test_unsupported_element_type():
    r = check_strength(**_base(element_type="plate_3d"))
    assert r["status"] == "needs_engineer"


def test_missing_section_dims():
    r = check_strength(**_base(section_dims={}))
    assert r["status"] == "needs_engineer"


def test_beam_custom_path():
    r = check_strength(element_type="beam_custom", length_mm=1000,
                       section_type="circle", section_dims={"diameter_mm": 40},
                       material_id="c45",
                       support_positions_mm=[0, 1000],
                       point_loads=[{"position_mm": 500, "force_n": 2000}])
    assert r["status"] == "ok"
    assert r["data"]["max_moment_nmm"] == 500_000
