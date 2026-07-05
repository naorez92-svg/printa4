"""רגרסיות מ-code review — כל בדיקה כאן מגנה על תיקון ספציפי."""
from backend.modules.cad_engine import _strip_code
from backend.modules.project_translator import _schedule
from backend.modules.strength_engine import check_strength


def test_gantt_forward_reference_dependency():
    """תלות שמופיעה בהמשך הרשימה חייבת להישמר, לא להתאפס ליום 0."""
    tasks = [{"id": 1, "days": 2, "depends_on": [3]},
             {"id": 2, "days": 1, "depends_on": [1]},
             {"id": 3, "days": 10, "depends_on": []}]
    assert _schedule(tasks) == {3: 0, 1: 10, 2: 12}


def test_gantt_cycle_does_not_hang():
    result = _schedule([{"id": 1, "days": 2, "depends_on": [2]},
                        {"id": 2, "days": 3, "depends_on": [1]}])
    assert set(result.keys()) == {1, 2}


def test_gantt_missing_dependency_treated_as_zero():
    assert _schedule([{"id": 1, "days": 5, "depends_on": [99]}]) == {1: 0}


def test_strip_json_fence_reaches_need_branch():
    assert _strip_code('```json\n{"need": ["אורך"]}\n```').startswith("{")


def test_strip_python_fence():
    assert _strip_code('```python\nimport cadquery as cq\nresult = 1\n```').startswith("import")


def test_strip_bare_fence():
    assert _strip_code('```\nresult = 1\n```') == "result = 1"


def test_beam_custom_rejects_distributed_load():
    """עומס מפורס במצב beam_custom נבלע בשקט לפני התיקון — עכשיו נחסם."""
    r = check_strength(element_type="beam_custom", length_mm=2000,
                       section_type="rectangle",
                       section_dims={"width_mm": 40, "height_mm": 80},
                       material_id="s235jr", support_positions_mm=[0, 2000],
                       point_loads=[{"position_mm": 1000, "force_n": 500}],
                       udl_n_per_mm=5)
    assert r["status"] == "needs_engineer"
    assert "מפורס" in r["summary_he"]
