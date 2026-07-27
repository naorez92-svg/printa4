"""Daily calorie + protein targets (build-plan section 4).

Mifflin-St Jeor × activity factor − 20% deficit.
Floors: 1500 kcal men / 1200 kcal women. Protein: 1.6g × goal weight.
"""

ACTIVITY_FACTORS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "high": 1.725,
}


def compute_targets(
    gender: str, age: int, height_cm: float, weight_kg: float,
    goal_weight_kg: float, activity_level: str = "light",
) -> tuple[int, int]:
    """Returns (daily_calorie_target, protein_target_g)."""
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (5 if gender == "male" else -161)
    tdee = bmr * ACTIVITY_FACTORS.get(activity_level, 1.375)
    target = tdee * 0.8  # 20% deficit
    floor = 1500 if gender == "male" else 1200
    calories = max(int(round(target)), floor)
    protein = int(round(1.6 * goal_weight_kg))
    return calories, protein
