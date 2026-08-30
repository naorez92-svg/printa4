"""בדיקות אינטגרציה של הזרימות מבוססות-LLM עם client מדומה.

מוכיחות את כל הצינור (LLM → כלי → מנוע דטרמיניסטי → תוצרים) בלי מפתח API אמיתי.
ה-LLM מדומה מחזיר בדיוק את מה ש-Claude היה מחזיר; כל החישוב והיצוא אמיתיים.
"""
import base64
import json
import types

import pytest


def _text_response(text: str, stop_reason: str = "end_turn"):
    return types.SimpleNamespace(
        stop_reason=stop_reason,
        content=[types.SimpleNamespace(type="text", text=text)],
    )


def _tool_response(name: str, tool_input: dict, tool_id: str = "t1"):
    return types.SimpleNamespace(
        stop_reason="tool_use",
        content=[types.SimpleNamespace(type="tool_use", name=name, input=tool_input, id=tool_id)],
    )


# --- M-01: CAD מתיאור חופשי → סקריפט אמיתי → sandbox → STEP/DXF/BOM ---
def test_generate_cad_full_pipeline(monkeypatch):
    from backend.modules import cad_engine

    script = ('import cadquery as cq\n'
              'L, W, T, hole = 120, 80, 10, 8.5\n'
              'result = (cq.Workplane("XY").box(L, W, T)\n'
              '          .faces(">Z").workplane().rect(96, 56, forConstruction=True)\n'
              '          .vertices().hole(hole))\n')
    monkeypatch.setattr(cad_engine, "complete", lambda *a, **k: _text_response(script))

    out = cad_engine.generate_cad("פלטת בסיס 120x80x10 עם 4 חורי M8", material_id="al6061")
    assert out["status"] == "ok", out
    # נפח ומסה מגיעים מ-OCC + טבלה, לא מה-LLM
    assert out["data"]["volume_mm3"] > 0
    assert out["data"]["mass_g"] > 0
    kinds = {a["kind"] for a in out["artifacts"]}
    assert {"step", "svg", "xlsx"} <= kinds  # dxf מיטב-מאמץ
    assert out["data"]["bom_rows"][0]["unit_cost_ils"] > 0


def test_generate_cad_missing_dimension_asks(monkeypatch):
    """LLM שמחזיר need[] → המערכת מבקשת מידות במקום לנחש."""
    from backend.modules import cad_engine
    monkeypatch.setattr(cad_engine, "complete",
                        lambda *a, **k: _text_response('{"need": ["אורך", "רוחב"]}'))
    out = cad_engine.generate_cad("תושבת", material_id="al6061")
    assert out["status"] == "error"
    assert "אורך" in out["summary_he"]


def test_generate_cad_rejects_malicious_script(monkeypatch):
    """אם ה-LLM מוחזר (למשל בהזרקה) סקריפט עם בריחה — ה-sandbox פוסל."""
    from backend.modules import cad_engine
    evil = ('def g():\n yield 1\n'
            'b = g().gi_frame.f_back.f_builtins\n'
            'result = 1\n')
    monkeypatch.setattr(cad_engine, "complete", lambda *a, **k: _text_response(evil))
    out = cad_engine.generate_cad("משהו", material_id="al6061")
    assert out["status"] == "error"
    assert out["artifacts"] == []


# --- M-04: מתכנן ייצור עם משוב DFM מדומה ---
def test_plan_process_with_llm_dfm(monkeypatch):
    from backend.modules import process_planner
    monkeypatch.setattr(process_planner, "complete",
                        lambda *a, **k: _text_response("שמור על רדיוסים פנימיים גדולים."))
    out = process_planner.plan_process("al6061", "prismatic", 200, 45,
                                       context_he="תושבת מכונה")
    assert out["status"] == "ok"
    assert out["data"]["dfm_note_he"]  # ה-context_he חובר ל-LLM
    assert out["data"]["recommended"]["unit_cost_ils"] > 0


# --- M-05: קורא שרטוטים — LLM מדומה מחזיר פירוש JSON ---
def test_read_drawing_pipeline(monkeypatch):
    from backend.modules import drawing_reader
    interp = {"part_name_he": "אוגן", "views_he": ["מבט על"],
              "dimensions": [{"label": "⌀50", "value": "50", "type": "קוטר"}],
              "issues_he": ["מידת עומק חסרה"], "summary_he": "אוגן עגול עם 4 חורים."}
    monkeypatch.setattr(drawing_reader, "complete",
                        lambda *a, **k: _text_response(json.dumps(interp, ensure_ascii=False)))
    png = base64.b64decode(  # PNG 1x1 תקין
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
    out = drawing_reader.read_drawing(png, "image/png", user_note_he="נתח")
    assert out["status"] == "ok"
    assert "אוגן" in out["summary_he"]
    assert "עומק" in out["summary_he"]  # הבעיה שזוהתה מוצגת
    assert out["artifacts"][0]["kind"] == "json"


# --- M-06: מתרגם לפרויקט — LLM מדומה → PDF אמיתי + לוח זמנים דטרמיניסטי ---
def test_translate_to_project_pipeline(monkeypatch):
    from backend.modules import project_translator
    plan = {"project_name_he": "ייצור תושבת",
            "tasks": [{"id": 1, "name_he": "תכן", "days": 3, "depends_on": [], "owner_role_he": "מהנדס"},
                      {"id": 2, "name_he": "ייצור", "days": 5, "depends_on": [1], "owner_role_he": "ספק"}],
            "milestones_he": ["אבטיפוס מאושר"],
            "risks": [{"risk_he": "עיכוב חומר", "mitigation_he": "הזמנה מוקדמת"}],
            "rfq_he": {"scope_he": "ייצור 200 יח'", "deliverables_he": ["200 תושבות"],
                       "quality_requirements_he": ["±0.1 מ\"מ"],
                       "info_needed_from_supplier_he": ["מחיר ליחידה"]}}
    monkeypatch.setattr(project_translator, "complete",
                        lambda *a, **k: _text_response(json.dumps(plan, ensure_ascii=False)))
    out = project_translator.translate_to_project("ייצור 200 תושבות אלומיניום")
    assert out["status"] == "ok"
    assert out["data"]["total_days"] == 8  # 3 + 5 דטרמיניסטי לפי התלות
    pdf = next(a for a in out["artifacts"] if a["kind"] == "pdf")
    with open(pdf["path"], "rb") as f:
        assert f.read(5) == b"%PDF-"


# --- Orchestrator: tool-calling מלא + אכיפת קו הבטיחות בקוד ---
def test_orchestrator_runs_strength_and_enforces_safety(monkeypatch):
    from backend import orchestrator
    from backend.safety import SAFETY_LINE

    calls = {"n": 0}

    def fake_complete(system, messages, max_tokens=4096, tools=None):
        calls["n"] += 1
        if calls["n"] == 1:
            return _tool_response("check_strength", {
                "element_type": "beam_analytic", "case": "simply_supported_point",
                "length_mm": 2000, "section_type": "rectangle",
                "section_dims": {"width_mm": 40, "height_mm": 80},
                "material_id": "s235jr", "load_n": 4905,
            })
        # הסבב השני: המודל מנסח תשובה — במכוון בלי קו הבטיחות, כדי לבדוק אכיפה
        return _text_response("הקורה תחזיק, מקדם ביטחון סביר.")

    monkeypatch.setattr(orchestrator, "complete", fake_complete)
    result = orchestrator.run_chat([], "האם קורת פלדה 40x80 באורך 2 מטר תחזיק חצי טון?")
    # קו הבטיחות המלא נאכף בקוד גם שהמודל השמיט אותו
    assert SAFETY_LINE in result["reply_he"]
    assert any(j["module"] == "M-02" for j in result["jobs"])


def test_orchestrator_surfaces_needs_engineer_from_any_module(monkeypatch):
    """plan_process שמחזיר needs_engineer → הדגל האדום נאכף בקוד."""
    from backend import orchestrator

    calls = {"n": 0}

    def fake_complete(system, messages, max_tokens=4096, tools=None):
        calls["n"] += 1
        if calls["n"] == 1:
            # כמות מחוץ לטווח → needs_engineer מ-M-04
            return _tool_response("plan_process", {
                "material_id": "al6061", "geometry": "prismatic",
                "quantity": 999999, "volume_cm3": 45,
            })
        return _text_response("הנה אפשרויות הייצור.")

    monkeypatch.setattr(orchestrator, "complete", fake_complete)
    result = orchestrator.run_chat([], "איך לייצר מיליון תושבות?")
    assert result["needs_engineer"] is True
    assert "🔴" in result["reply_he"]
