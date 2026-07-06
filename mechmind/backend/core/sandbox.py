"""Sandbox להרצת סקריפטי CadQuery שנוצרו על-ידי ה-LLM.

שתי שכבות הגנה:
1. ולידציית AST — רק ייבוא cadquery/math, בלי גישה לקבצים/רשת/רפלקשן.
2. subprocess מבודד — סביבה נקייה (בלי proxy → בלי רשת), מגבלות CPU/זיכרון,
   timeout קשיח, תיקיית פלט ייעודית בלבד.
"""
from __future__ import annotations

import ast
import json
import os
import resource
import subprocess
import sys
import tempfile
from pathlib import Path

RUNNER_PATH = Path(__file__).resolve().parent / "sandbox_runner.py"

MAX_SCRIPT_CHARS = 20_000
TIMEOUT_SECONDS = 40  # כולל זמן ייבוא cadquery (~5 שניות); ההרצה עצמה מוגבלת CPU

ALLOWED_IMPORTS = {"cadquery", "math"}

FORBIDDEN_NAMES = {
    "open", "exec", "eval", "compile", "__import__", "input", "breakpoint",
    "globals", "locals", "vars", "getattr", "setattr", "delattr",
    "memoryview", "exit", "quit",
    "os", "sys", "subprocess", "socket", "shutil", "pathlib", "importlib",
    "builtins", "ctypes", "pickle", "marshal", "signal", "threading",
    "multiprocessing", "requests", "urllib", "http",
}

# משפחות תכונות של רפלקציית פריים/גנרטור/קוד/traceback. הבריחה הקלאסית
# היא gen.gi_frame.f_back...f_builtins → בילטינס אמיתיים → RCE. אף אחת מהן
# אינה מתחילה ב-__ ולכן חמקה מבדיקת ה-dunder. חוסמים את כל המשפחה בתחילית,
# כדי לא להסתמך על מנייה של כל שם בנפרד.
INTROSPECTION_PREFIXES = ("f_", "gi_", "cr_", "ag_", "tb_", "co_")

# שיטות קלט/פלט של CadQuery/OCC — הראנר עצמו מייצא את התוצאה; לסקריפט המשתמש
# אין צורך לגעת בקבצים, וללא החסימה הזו הוא יכול לכתוב לכל נתיב (למשל לדרוס
# את מסד הנתונים או קבצי מקור) דרך ה-API של cadquery, שעוקף את חסימת open/os.
FORBIDDEN_ATTRS = {
    "export", "exportstep", "exportstl", "exportdxf", "exportsvg", "exportbrep",
    "exportgltf", "exportbin", "exportgraphviz", "exportvtkjs", "exportvrml",
    "save", "savetofile", "tostep", "write", "writestep", "writestl",
    "importstep", "importdxf", "importshape", "importbrep", "importers",
    "exporters", "system", "popen", "spawn",
}


def _is_introspection(name: str) -> bool:
    return name.startswith(INTROSPECTION_PREFIXES)


class ScriptRejected(Exception):
    """הסקריפט נפסל בולידציה — לא יורץ."""


def validate_script(code: str) -> None:
    """ולידציית AST. זורק ScriptRejected עם הסבר בעברית אם הסקריפט מסוכן."""
    if len(code) > MAX_SCRIPT_CHARS:
        raise ScriptRejected("הסקריפט ארוך מדי")
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise ScriptRejected(f"שגיאת תחביר בסקריפט: {e}") from e

    assigns_result = False
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name.split(".")[0] not in ALLOWED_IMPORTS:
                    raise ScriptRejected(f"ייבוא אסור: {alias.name}")
        elif isinstance(node, ast.ImportFrom):
            if (node.module or "").split(".")[0] not in ALLOWED_IMPORTS:
                raise ScriptRejected(f"ייבוא אסור: {node.module}")
        elif isinstance(node, ast.Name):
            if node.id in FORBIDDEN_NAMES or _is_introspection(node.id):
                raise ScriptRejected(f"שימוש אסור בשם: {node.id}")
            if isinstance(node.ctx, ast.Store) and node.id == "result":
                assigns_result = True
        elif isinstance(node, ast.Attribute):
            attr = node.attr
            if attr.startswith("__") or _is_introspection(attr):
                raise ScriptRejected(f"גישה אסורה לתכונה פנימית: {attr}")
            if attr in FORBIDDEN_NAMES or attr.lower() in FORBIDDEN_ATTRS:
                raise ScriptRejected(f"שימוש אסור בתכונה: {attr}")
        elif isinstance(node, (ast.Global, ast.Nonlocal)):
            raise ScriptRejected("שימוש אסור ב-global/nonlocal")
        elif isinstance(node, (ast.AsyncFunctionDef, ast.Await)):
            raise ScriptRejected("קוד אסינכרוני אסור")
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            if "__" in node.value and len(node.value) < 60:
                # חוסם עקיפה דרך getattr במחרוזת ("__globals__" וכד')
                if any(d in node.value for d in ("__globals__", "__builtins__",
                                                 "__subclasses__", "__import__",
                                                 "__class__", "__bases__", "__mro__")):
                    raise ScriptRejected("מחרוזת חשודה בסקריפט")

    if not assigns_result:
        raise ScriptRejected("הסקריפט חייב להגדיר משתנה בשם result עם המודל")


def _kill_process_group(proc: "subprocess.Popen") -> None:
    import signal
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        proc.kill()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


def _limit_resources() -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (25, 25))
    # OCC/TBB שומרים הרבה זיכרון וירטואלי (VIRT) גם ב-RSS נמוך — cap נמוך מדי
    # הפיל מודלים לגיטימיים. 8 GiB מגן מפני ריצה חופשית בלי לפסול מודל תקין.
    resource.setrlimit(resource.RLIMIT_AS, (8 * 1024**3, 8 * 1024**3))
    resource.setrlimit(resource.RLIMIT_FSIZE, (60 * 1024**2, 60 * 1024**2))
    resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
    os.setsid()  # קבוצת תהליכים חדשה — מאפשרת להרוג את כל הצאצאים ב-timeout


def run_cadquery_script(code: str, out_dir: str | Path) -> dict:
    """מריץ סקריפט CadQuery מאומת ב-subprocess מבודד.

    מחזיר: {"ok": True, "volume_mm3": ..., "files": {...}} או {"ok": False, "error_he": ...}
    """
    validate_script(code)
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="mechmind_sbx_") as tmp:
        script_file = Path(tmp) / "script.py"
        script_file.write_text(code, encoding="utf-8")

        clean_env = {
            "PATH": "/usr/bin:/bin",
            "HOME": tmp,
            "TMPDIR": tmp,
            "LANG": "C.UTF-8",
            # יציאת רשת נחסמת ע"י כך שהסקריפט אינו יכול לייבא socket/urllib וכו'
            # (ולידציית AST + allowlist הייבוא בראנר). הסרת ה-proxy אינה חוסמת
            # רשת בפני עצמה — ההגנה היא ברמת הייבוא, לא ברמת הסביבה.
        }
        proc = subprocess.Popen(
            [sys.executable, str(RUNNER_PATH), str(script_file), str(out_path)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            env=clean_env, cwd=tmp, preexec_fn=_limit_resources,
        )
        try:
            _, stderr = proc.communicate(timeout=TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            # os.setsid בראנר הפך אותו למוביל קבוצת-תהליכים — הורגים את כל
            # הקבוצה כדי לא להשאיר צאצאים יתומים (OCC/TBB עלול לפצל תהליכים).
            _kill_process_group(proc)
            return {"ok": False, "error_he": "הרצת המודל חרגה מזמן המקסימום — פשט את הגאומטריה"}

        if proc.returncode != 0:
            tail = (stderr or "").strip().splitlines()[-3:]
            return {"ok": False,
                    "error_he": "שגיאה בבניית המודל: " + (" | ".join(tail) or "כשל לא ידוע")}

        meta_file = out_path / "meta.json"
        if not meta_file.exists():
            return {"ok": False, "error_he": "המודל נבנה אך לא נוצרו קבצי פלט"}
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
        return {"ok": True, **meta}
