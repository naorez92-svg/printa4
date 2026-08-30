"""חישובי קורה אנליטיים — כל מספר כאן מגיע מנוסחה, לא מ-LLM.

יחידות: אורך במ"מ, כוח בניוטון, עומס מפורס ב-N/mm, מאמץ ב-MPa (N/mm²).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field


class UnsupportedCase(Exception):
    """מקרה שמחוץ לטווח הנתמך — חייב להחזיר needs_engineer, לא ניחוש."""


# ---------------------------------------------------------------------------
# תכונות חתך
# ---------------------------------------------------------------------------

@dataclass
class SectionProperties:
    area_mm2: float          # שטח חתך
    inertia_mm4: float       # מומנט אינרציה סביב ציר הכפיפה
    section_modulus_mm3: float  # מודול חתך W = I / c
    description_he: str = ""


def rectangle_section(width_mm: float, height_mm: float) -> SectionProperties:
    """חתך מלבני מלא. הכפיפה סביב הציר האופקי (הגובה נושא)."""
    _require_positive(width_mm=width_mm, height_mm=height_mm)
    inertia = width_mm * height_mm**3 / 12.0
    return SectionProperties(
        area_mm2=width_mm * height_mm,
        inertia_mm4=inertia,
        section_modulus_mm3=inertia / (height_mm / 2.0),
        description_he=f"מלבן {width_mm:g}×{height_mm:g} מ\"מ",
    )


def circle_section(diameter_mm: float) -> SectionProperties:
    """חתך עגול מלא."""
    _require_positive(diameter_mm=diameter_mm)
    inertia = math.pi * diameter_mm**4 / 64.0
    return SectionProperties(
        area_mm2=math.pi * diameter_mm**2 / 4.0,
        inertia_mm4=inertia,
        section_modulus_mm3=inertia / (diameter_mm / 2.0),
        description_he=f"עגול מלא ⌀{diameter_mm:g} מ\"מ",
    )


def tube_section(outer_diameter_mm: float, wall_mm: float) -> SectionProperties:
    """צינור עגול."""
    _require_positive(outer_diameter_mm=outer_diameter_mm, wall_mm=wall_mm)
    inner = outer_diameter_mm - 2.0 * wall_mm
    if inner <= 0:
        raise UnsupportedCase("עובי הדופן גדול מדי ביחס לקוטר — זהו מוט מלא, לא צינור")
    inertia = math.pi * (outer_diameter_mm**4 - inner**4) / 64.0
    return SectionProperties(
        area_mm2=math.pi * (outer_diameter_mm**2 - inner**2) / 4.0,
        inertia_mm4=inertia,
        section_modulus_mm3=inertia / (outer_diameter_mm / 2.0),
        description_he=f"צינור ⌀{outer_diameter_mm:g}×{wall_mm:g} מ\"מ",
    )


def box_section(width_mm: float, height_mm: float, wall_mm: float) -> SectionProperties:
    """פרופיל מלבני חלול (RHS)."""
    _require_positive(width_mm=width_mm, height_mm=height_mm, wall_mm=wall_mm)
    iw = width_mm - 2.0 * wall_mm
    ih = height_mm - 2.0 * wall_mm
    if iw <= 0 or ih <= 0:
        raise UnsupportedCase("עובי הדופן גדול מדי ביחס לממדי הפרופיל")
    inertia = (width_mm * height_mm**3 - iw * ih**3) / 12.0
    return SectionProperties(
        area_mm2=width_mm * height_mm - iw * ih,
        inertia_mm4=inertia,
        section_modulus_mm3=inertia / (height_mm / 2.0),
        description_he=f"פרופיל מלבני {width_mm:g}×{height_mm:g}×{wall_mm:g} מ\"מ",
    )


SECTION_BUILDERS = {
    "rectangle": (rectangle_section, ("width_mm", "height_mm")),
    "circle": (circle_section, ("diameter_mm",)),
    "tube": (tube_section, ("outer_diameter_mm", "wall_mm")),
    "box": (box_section, ("width_mm", "height_mm", "wall_mm")),
}


def build_section(section_type: str, dims: dict) -> SectionProperties:
    if section_type not in SECTION_BUILDERS:
        raise UnsupportedCase(f"סוג חתך לא נתמך: {section_type}")
    builder, keys = SECTION_BUILDERS[section_type]
    missing = [k for k in keys if k not in dims or dims[k] is None]
    if missing:
        raise UnsupportedCase(f"חסרות מידות חתך: {', '.join(missing)}")
    return builder(**{k: float(dims[k]) for k in keys})


# ---------------------------------------------------------------------------
# מקרי קורה אנליטיים
# ---------------------------------------------------------------------------

@dataclass
class BeamResult:
    case_he: str
    max_moment_nmm: float
    max_shear_n: float
    max_deflection_mm: float | None  # None אם E לא סופק
    formulas: dict = field(default_factory=dict)


def solve_beam(
    case: str,
    length_mm: float,
    load_n: float | None = None,
    udl_n_per_mm: float | None = None,
    elastic_modulus_mpa: float | None = None,
    inertia_mm4: float | None = None,
) -> BeamResult:
    """ארבעת המקרים הקלאסיים. כל נוסחה מתועדת בתוצאה לשקיפות מלאה."""
    _require_positive(length_mm=length_mm)
    L = length_mm
    EI = None
    if elastic_modulus_mpa and inertia_mm4:
        EI = elastic_modulus_mpa * inertia_mm4  # N·mm²

    if case == "simply_supported_point":
        P = _require_load(load_n, "load_n")
        m, v = P * L / 4.0, P / 2.0
        d = P * L**3 / (48.0 * EI) if EI else None
        return BeamResult("קורה נסמכת, כוח מרוכז במרכז", m, v, d,
                          {"M_max": "P·L/4", "δ_max": "P·L³/(48·E·I)"})
    if case == "simply_supported_udl":
        w = _require_load(udl_n_per_mm, "udl_n_per_mm")
        m, v = w * L**2 / 8.0, w * L / 2.0
        d = 5.0 * w * L**4 / (384.0 * EI) if EI else None
        return BeamResult("קורה נסמכת, עומס מפורס אחיד", m, v, d,
                          {"M_max": "w·L²/8", "δ_max": "5·w·L⁴/(384·E·I)"})
    if case == "cantilever_point":
        P = _require_load(load_n, "load_n")
        m, v = P * L, P
        d = P * L**3 / (3.0 * EI) if EI else None
        return BeamResult("קורה קונזולית (זיז), כוח מרוכז בקצה", m, v, d,
                          {"M_max": "P·L", "δ_max": "P·L³/(3·E·I)"})
    if case == "cantilever_udl":
        w = _require_load(udl_n_per_mm, "udl_n_per_mm")
        m, v = w * L**2 / 2.0, w * L
        d = w * L**4 / (8.0 * EI) if EI else None
        return BeamResult("קורה קונזולית (זיז), עומס מפורס אחיד", m, v, d,
                          {"M_max": "w·L²/2", "δ_max": "w·L⁴/(8·E·I)"})

    raise UnsupportedCase(f"מקרה קורה לא נתמך אנליטית: {case}")


def solve_beam_anastruct(
    length_mm: float,
    support_positions_mm: list[float],
    point_loads: list[dict],
    elastic_modulus_mpa: float,
    inertia_mm4: float,
    area_mm2: float,
) -> BeamResult:
    """קורה על שתי תמיכות במיקומים שרירותיים עם כוחות מרוכזים — פתרון anastruct.

    point_loads: [{"position_mm": float, "force_n": float}] — כוח חיובי = כלפי מטה.
    """
    _require_positive(length_mm=length_mm)
    if len(support_positions_mm) != 2:
        raise UnsupportedCase("נתמכות בדיוק שתי תמיכות; מקרה אחר דורש מהנדס")
    if not point_loads:
        raise UnsupportedCase("לא הוגדרו עומסים")
    for s in support_positions_mm:
        if not 0 <= s <= length_mm:
            raise UnsupportedCase("מיקום תמיכה מחוץ לאורך הקורה")
    if abs(support_positions_mm[0] - support_positions_mm[1]) < 1e-9:
        raise UnsupportedCase("שתי התמיכות באותו מיקום")
    for p in point_loads:
        if not 0 <= float(p["position_mm"]) <= length_mm:
            raise UnsupportedCase("מיקום עומס מחוץ לאורך הקורה")
        if float(p["force_n"]) <= 0:
            raise UnsupportedCase("כוח חייב להיות חיובי (כלפי מטה)")

    from anastruct import SystemElements

    # רשת נקודות: קצוות, תמיכות, עומסים + עידון של 40 נקודות — כדי שהשקיעה
    # המקסימלית (הנקראת מהצמתים) תיתפס גם בין נקודות העניין
    special = {0.0, length_mm, *map(float, support_positions_mm),
               *(float(p["position_mm"]) for p in point_loads)}
    grid = {round(length_mm * i / 40.0, 6) for i in range(41)}
    xs = sorted(special | grid)
    ss = SystemElements(EA=elastic_modulus_mpa * area_mm2, EI=elastic_modulus_mpa * inertia_mm4)
    for x1, x2 in zip(xs, xs[1:]):
        ss.add_element(location=[[x1, 0.0], [x2, 0.0]])

    def node_at(x: float) -> int:
        nid = ss.find_node_id(vertex=[x, 0.0])
        if nid is None:
            raise UnsupportedCase("שגיאה פנימית בבניית מודל הקורה")
        return nid

    ss.add_support_hinged(node_id=node_at(support_positions_mm[0]))
    ss.add_support_roll(node_id=node_at(support_positions_mm[1]), direction=2)
    for p in point_loads:
        ss.point_load(node_id=node_at(float(p["position_mm"])), Fy=-abs(float(p["force_n"])))
    ss.solve()

    moments, shears = [], []
    for el in ss.element_map.values():
        if el.bending_moment is not None:
            moments.extend(abs(m) for m in el.bending_moment)
        if el.shear_force is not None:
            shears.extend(abs(v) for v in el.shear_force)
    # שקיעה אנכית נקראת מהזזות הצמתים (uy) — el.deflection הוא ערך לוקאלי לא רלוונטי
    deflections = [abs(d["uy"]) for d in ss.get_node_displacements()]

    return BeamResult(
        case_he="קורה על שתי תמיכות עם כוחות מרוכזים (פתרון נומרי anastruct)",
        max_moment_nmm=max(moments) if moments else 0.0,
        max_shear_n=max(shears) if shears else 0.0,
        max_deflection_mm=max(deflections) if deflections else None,
        formulas={"solver": "anastruct FEM"},
    )


# ---------------------------------------------------------------------------
# מאמץ ומקדם ביטחון
# ---------------------------------------------------------------------------

def bending_stress_mpa(moment_nmm: float, section_modulus_mm3: float) -> float:
    """σ = M / W"""
    if section_modulus_mm3 <= 0:
        raise UnsupportedCase("מודול חתך לא חוקי")
    return moment_nmm / section_modulus_mm3


def safety_factor(yield_strength_mpa: float, stress_mpa: float) -> float:
    """FS = σ_yield / σ. אם המאמץ אפסי — מחזירים אינסוף מעשי."""
    if yield_strength_mpa <= 0:
        raise UnsupportedCase("חוזק כניעה לא חוקי")
    if stress_mpa <= 1e-12:
        return float("inf")
    return yield_strength_mpa / stress_mpa


def _require_positive(**kwargs: float) -> None:
    for name, value in kwargs.items():
        if value is None or not math.isfinite(float(value)) or float(value) <= 0:
            raise UnsupportedCase(f"ערך לא חוקי עבור {name}: חייב להיות מספר חיובי")


def _require_load(value: float | None, name: str) -> float:
    if value is None:
        raise UnsupportedCase(f"חסר עומס: {name}")
    v = float(value)
    if not math.isfinite(v) or v <= 0:
        raise UnsupportedCase(f"עומס לא חוקי עבור {name}: חייב להיות חיובי")
    return v
