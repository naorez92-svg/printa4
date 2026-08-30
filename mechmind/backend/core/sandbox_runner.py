"""ראנר ה-sandbox — מורץ כ-subprocess מבודד בלבד, לעולם לא ב-import ישיר.

מקבל: נתיב סקריפט + תיקיית פלט. מריץ את הסקריפט עם builtins מצומצמים,
מייצא STEP/DXF/SVG ומחשב נפח — הנפח מגיע מ-OCC, לא מה-LLM.
"""
import json
import math
import sys


def make_safe_builtins() -> dict:
    allowed = [
        "abs", "all", "any", "bool", "dict", "divmod", "enumerate", "filter",
        "float", "int", "isinstance", "len", "list", "map", "max", "min",
        "pow", "print", "range", "repr", "reversed", "round", "set", "slice",
        "sorted", "str", "sum", "tuple", "zip",
        "ArithmeticError", "AttributeError", "Exception", "IndexError",
        "KeyError", "TypeError", "ValueError", "ZeroDivisionError",
    ]
    import builtins as real_builtins
    safe = {name: getattr(real_builtins, name) for name in allowed}

    def limited_import(name, *args, **kwargs):
        if name.split(".")[0] not in ("cadquery", "math"):
            raise ImportError(f"import of {name} is not allowed")
        return __import__(name, *args, **kwargs)

    safe["__import__"] = limited_import
    return safe


def main() -> int:
    script_path, out_dir = sys.argv[1], sys.argv[2]
    with open(script_path, encoding="utf-8") as f:
        code = f.read()

    import cadquery as cq

    env = {"__builtins__": make_safe_builtins(), "cq": cq, "cadquery": cq, "math": math}
    exec(compile(code, "<mechmind-model>", "exec"), env)  # noqa: S102 — קוד עבר ולידציית AST בשכבה הקוראת

    result = env.get("result")
    if result is None:
        print("script did not define `result`", file=sys.stderr)
        return 2

    if isinstance(result, cq.Workplane):
        workplane = result
    elif isinstance(result, cq.Shape):
        workplane = cq.Workplane(obj=result)
    elif isinstance(result, cq.Assembly):
        workplane = cq.Workplane(obj=result.toCompound())
    else:
        print(f"`result` has unsupported type {type(result).__name__}", file=sys.stderr)
        return 2

    solids = workplane.solids().vals()
    if not solids:
        print("model contains no solid bodies", file=sys.stderr)
        return 2
    volume_mm3 = sum(s.Volume() for s in solids)

    compound = workplane.val() if len(workplane.vals()) == 1 else cq.Compound.makeCompound(workplane.vals())
    bb = compound.BoundingBox()

    step_path = f"{out_dir}/model.step"
    svg_path = f"{out_dir}/preview.svg"
    dxf_path = f"{out_dir}/model.dxf"

    cq.exporters.export(workplane, step_path)
    cq.exporters.export(
        workplane, svg_path,
        opt={"projectionDir": (1, 1, 0.7), "showAxes": False, "marginLeft": 20,
             "marginTop": 20, "width": 480, "height": 360,
             "strokeColor": (32, 24, 74), "showHidden": False},
    )

    files = {"step": "model.step", "svg": "preview.svg"}
    try:
        z_mid = (bb.zmin + bb.zmax) / 2.0
        section = cq.Workplane("XY", origin=(0, 0, z_mid)).add(compound).section()
        cq.exporters.export(section, dxf_path)
        files["dxf"] = "model.dxf"
    except Exception as e:  # DXF הוא מיטב-מאמץ — חתך עלול להיכשל בגאומטריות מסוימות
        print(f"dxf export skipped: {e}", file=sys.stderr)

    meta = {
        "volume_mm3": round(volume_mm3, 2),
        "bounding_box_mm": {
            "x": round(bb.xlen, 2), "y": round(bb.ylen, 2), "z": round(bb.zlen, 2),
        },
        "solid_count": len(solids),
        "files": files,
    }
    with open(f"{out_dir}/meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
