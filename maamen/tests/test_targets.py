"""Calorie/protein target computation — 3 cases + floors (build-plan section 4)."""
from server.engine.targets import compute_targets


def test_male_moderate():
    # BMR = 10*95 + 6.25*178 - 5*35 + 5 = 1892.5 ; ×1.55 ×0.8 = 2346
    calories, protein = compute_targets("male", 35, 178, 95, 85, "moderate")
    assert calories == 2347 or calories == 2346  # rounding
    assert protein == 136


def test_female_sedentary():
    # BMR = 10*70 + 6.25*165 - 5*40 - 161 = 1370.25 ; ×1.2 ×0.8 = 1315
    calories, protein = compute_targets("female", 40, 165, 70, 62, "sedentary")
    assert 1310 <= calories <= 1320
    assert protein == 99  # 1.6 × 62


def test_floor_applies():
    # tiny person → below floor → floor wins
    calories, _ = compute_targets("female", 60, 150, 45, 45, "sedentary")
    assert calories == 1200
    calories_m, _ = compute_targets("male", 70, 155, 50, 50, "sedentary")
    assert calories_m == 1500
