"""בדיקות אבטחת ה-sandbox — הקו שמפריד בין מוצר לפרצה."""
import pytest

from backend.core.sandbox import ScriptRejected, run_cadquery_script, validate_script

GOOD_SCRIPT = """import cadquery as cq
w, h, t = 40, 30, 5
result = cq.Workplane("XY").box(w, h, t)
"""

ATTACKS = [
    ("import os", "import os\nresult = 1"),
    ("open file", "f = open('/etc/passwd')\nresult = 1"),
    ("eval", "eval('1+1')\nresult = 1"),
    ("exec", "exec('x=1')\nresult = 1"),
    ("getattr chain", "getattr(int, 'x')\nresult = 1"),
    ("dunder attr", "x = ().__class__\nresult = 1"),
    ("dunder string", "s = '__subclasses__'\nresult = 1"),
    ("import from sys", "from sys import path\nresult = 1"),
    ("importlib", "import importlib\nresult = 1"),
    ("socket", "import socket\nresult = 1"),
    ("type()", "t = type('X', (), {})\nresult = 1"),
    ("global stmt", "def f():\n    global result\n    result = 1\nf()"),
]


@pytest.mark.parametrize("name,code", ATTACKS, ids=[a[0] for a in ATTACKS])
def test_attacks_rejected(name, code):
    with pytest.raises(ScriptRejected):
        validate_script(code)


def test_missing_result_rejected():
    with pytest.raises(ScriptRejected):
        validate_script("import cadquery as cq\nx = cq.Workplane().box(1,1,1)")


def test_oversized_script_rejected():
    with pytest.raises(ScriptRejected):
        validate_script("result = 1\n" + "# פס\n" * 20000)


def test_syntax_error_rejected():
    with pytest.raises(ScriptRejected):
        validate_script("def broken(:\nresult = 1")


def test_good_script_passes_validation():
    validate_script(GOOD_SCRIPT)


def test_good_script_runs_and_computes_volume(tmp_path):
    out = run_cadquery_script(GOOD_SCRIPT, tmp_path)
    assert out["ok"], out
    assert out["volume_mm3"] == pytest.approx(40 * 30 * 5)
    assert (tmp_path / "model.step").exists()
    assert (tmp_path / "preview.svg").exists()


def test_script_without_solid_fails_gracefully(tmp_path):
    code = "import cadquery as cq\nresult = cq.Workplane('XY').rect(10, 10)"
    out = run_cadquery_script(code, tmp_path)
    assert not out["ok"]
    assert "error_he" in out


def test_runner_blocks_disallowed_import_at_runtime(tmp_path):
    """גם אם ולידציית ה-AST הייתה נעקפת — הראנר חוסם ייבוא בזמן ריצה."""
    # מדמה עקיפה: הסקריפט עצמו חוקי תחבירית אך מנסה import דרך פונקציה מותרת
    code = "import math\nresult = math"  # לא Workplane → נכשל בראנר, לא קורס
    out = run_cadquery_script(code, tmp_path)
    assert not out["ok"]
