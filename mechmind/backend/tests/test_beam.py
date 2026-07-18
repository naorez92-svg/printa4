"""אימות חישובי הקורה מול חישובי יד — הלב של אמינות M-02."""
import math

import pytest

from backend.core import beam


def test_rectangle_section():
    s = beam.rectangle_section(20, 40)
    assert s.area_mm2 == 800
    assert s.inertia_mm4 == pytest.approx(20 * 40**3 / 12)
    assert s.section_modulus_mm3 == pytest.approx(20 * 40**2 / 6)


def test_circle_section():
    s = beam.circle_section(30)
    assert s.inertia_mm4 == pytest.approx(math.pi * 30**4 / 64)
    assert s.section_modulus_mm3 == pytest.approx(math.pi * 30**3 / 32)


def test_tube_section():
    s = beam.tube_section(50, 5)
    inner = 40
    assert s.inertia_mm4 == pytest.approx(math.pi * (50**4 - inner**4) / 64)


def test_tube_wall_too_thick():
    with pytest.raises(beam.UnsupportedCase):
        beam.tube_section(20, 12)


def test_box_section():
    s = beam.box_section(60, 40, 4)
    expected_i = (60 * 40**3 - 52 * 32**3) / 12
    assert s.inertia_mm4 == pytest.approx(expected_i)


def test_simply_supported_point():
    # L=2m, P=5kN: M = PL/4 = 2.5e6 N·mm, V = 2.5kN
    r = beam.solve_beam("simply_supported_point", 2000, load_n=5000)
    assert r.max_moment_nmm == pytest.approx(2_500_000)
    assert r.max_shear_n == pytest.approx(2500)


def test_simply_supported_udl():
    # L=1m, w=2 N/mm: M = wL²/8 = 250,000
    r = beam.solve_beam("simply_supported_udl", 1000, udl_n_per_mm=2)
    assert r.max_moment_nmm == pytest.approx(250_000)
    assert r.max_shear_n == pytest.approx(1000)


def test_cantilever_point_with_deflection():
    s = beam.rectangle_section(20, 40)
    r = beam.solve_beam("cantilever_point", 500, load_n=200,
                        elastic_modulus_mpa=210000, inertia_mm4=s.inertia_mm4)
    assert r.max_moment_nmm == pytest.approx(100_000)
    expected_d = 200 * 500**3 / (3 * 210000 * s.inertia_mm4)
    assert r.max_deflection_mm == pytest.approx(expected_d)


def test_cantilever_udl():
    r = beam.solve_beam("cantilever_udl", 800, udl_n_per_mm=1.5)
    assert r.max_moment_nmm == pytest.approx(1.5 * 800**2 / 2)


def test_unsupported_case_raises():
    with pytest.raises(beam.UnsupportedCase):
        beam.solve_beam("torsion", 1000, load_n=10)


def test_negative_length_rejected():
    with pytest.raises(beam.UnsupportedCase):
        beam.solve_beam("cantilever_point", -100, load_n=10)


def test_zero_load_rejected():
    with pytest.raises(beam.UnsupportedCase):
        beam.solve_beam("cantilever_point", 100, load_n=0)


def test_stress_and_safety_factor():
    sigma = beam.bending_stress_mpa(250_000, 5333.33)
    assert sigma == pytest.approx(46.875, rel=1e-3)
    assert beam.safety_factor(235, sigma) == pytest.approx(5.013, rel=1e-3)
    assert beam.safety_factor(235, 0) == float("inf")


def test_anastruct_matches_analytic():
    s = beam.rectangle_section(20, 40)
    r = beam.solve_beam_anastruct(1000, [0, 1000], [{"position_mm": 500, "force_n": 1000}],
                                  210000, s.inertia_mm4, s.area_mm2)
    assert r.max_moment_nmm == pytest.approx(250_000, rel=0.01)
    assert r.max_deflection_mm == pytest.approx(0.9301, rel=0.01)


def test_anastruct_asymmetric():
    # R1=125N → M במיקום העומס = 125*600 = 75,000
    s = beam.rectangle_section(20, 40)
    r = beam.solve_beam_anastruct(1000, [0, 800], [{"position_mm": 600, "force_n": 500}],
                                  210000, s.inertia_mm4, s.area_mm2)
    assert r.max_moment_nmm == pytest.approx(75_000, rel=0.01)


def test_anastruct_rejects_bad_input():
    s = beam.rectangle_section(20, 40)
    with pytest.raises(beam.UnsupportedCase):
        beam.solve_beam_anastruct(1000, [0], [{"position_mm": 500, "force_n": 100}],
                                  210000, s.inertia_mm4, s.area_mm2)
    with pytest.raises(beam.UnsupportedCase):
        beam.solve_beam_anastruct(1000, [0, 1500], [{"position_mm": 500, "force_n": 100}],
                                  210000, s.inertia_mm4, s.area_mm2)
    with pytest.raises(beam.UnsupportedCase):
        beam.solve_beam_anastruct(1000, [0, 1000], [], 210000, s.inertia_mm4, s.area_mm2)
