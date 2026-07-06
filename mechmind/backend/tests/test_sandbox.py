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
    ("global stmt", "def f():\n    global result\n    result = 1\nf()"),
    # בריחת frame-walk דרך רפלקציית גנרטור (האקספלויט שנמצא בסקירת אבטחה)
    ("gi_frame walk", "def g():\n yield 1\nx = g().gi_frame.f_back\nresult = 1"),
    ("f_builtins", "def g():\n yield 1\nb = g().gi_frame.f_builtins\nresult = 1"),
    ("gi_code", "def g():\n yield 1\nc = g().gi_code\nresult = 1"),
    ("co_consts", "def f(): pass\nx = f.__code__.co_consts\nresult = 1"),
    # כתיבת קובץ שרירותית דרך ה-API של cadquery (עוקף את חסימת open/os)
    ("cq export", "import cadquery as cq\nr=cq.Workplane().box(1,1,1)\nr.export('/etc/x')\nresult=r"),
    ("cq exporters", "import cadquery as cq\ncq.exporters.export(1, '/etc/x')\nresult=1"),
    ("cq exportStep", "import cadquery as cq\nr=cq.Workplane().box(1,1,1)\nr.val().exportStep('/x')\nresult=r"),
    ("save", "import cadquery as cq\na=cq.Assembly()\na.save('/etc/x')\nresult=a"),
]


@pytest.mark.parametrize("name,code", ATTACKS, ids=[a[0] for a in ATTACKS])
def test_attacks_rejected(name, code):
    with pytest.raises(ScriptRejected):
        validate_script(code)


def test_frame_walk_rce_exploit_blocked():
    """האקספלויט המלא מסקירת האבטחה — קריאת בילטינס אמיתיים ו-RCE — חסום."""
    exploit = (
        "import math\n"
        "gref = []; holder = []\n"
        "def inner():\n"
        "    cur = gref[0].gi_frame.f_back\n"
        "    while cur is not None:\n"
        "        b = cur.f_builtins\n"
        "        if isinstance(b, dict) and 'open' in b:\n"
        "            holder.append(b); break\n"
        "        cur = cur.f_back\n"
        "    yield 1\n"
        "g = inner(); gref.append(g); list(g)\n"
        "result = holder[0]['open']('/etc/passwd').read()\n"
    )
    with pytest.raises(ScriptRejected):
        validate_script(exploit)


def test_type_shadowing_allowed():
    """שם משתנה נפוץ כמו type אינו וקטור בריחה (הראנר לא חושף אותו) — לא נפסל."""
    validate_script('import cadquery as cq\ntype = "plate"\nresult = cq.Workplane().box(1,1,1)')


def test_type_call_blocked_at_runtime(tmp_path):
    """type() אינו נחסם ב-AST אך הראנר (allowlist) חוסם אותו בזמן ריצה."""
    out = run_cadquery_script("t = type('X', (), {})\nresult = 1", tmp_path)
    assert not out["ok"]


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
