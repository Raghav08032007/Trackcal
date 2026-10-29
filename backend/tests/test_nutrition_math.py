"""Phase 2 (E): pure nutrition maths — scaling, servings, totals, rounding and the consistency flag."""
import random

import pytest

from services import nutrition_math as nm

EGG = {"energy_kcal": 155, "protein_g": 13, "carbs_g": 1.1, "fat_g": 11}


def test_scaling_per_100g_to_grams():
    assert nm.rounded(nm.scale(EGG, 50)) == {"energy_kcal": 78, "protein_g": 6.5, "carbs_g": 0.6, "fat_g": 5.5}


def test_unknown_values_stay_unknown_when_scaled():
    assert nm.scale({**EGG, "fat_g": None}, 200)["fat_g"] is None


@pytest.mark.parametrize("grams", [-1, float("nan"), float("inf"), True, "50"])
def test_invalid_grams_are_rejected(grams):
    with pytest.raises(ValueError): nm.scale(EGG, grams)


@pytest.mark.parametrize("bad", [-1, float("nan"), "13", True])
def test_invalid_nutrient_values_are_rejected(bad):
    with pytest.raises(ValueError): nm.scale({**EGG, "protein_g": bad}, 100)


def test_scaling_is_linear_property():
    rng = random.Random(11)
    for _ in range(500):
        food = {f: rng.uniform(0, 900) for f in nm.FIELDS}
        a, b = rng.uniform(0, 1000), rng.uniform(0, 1000)
        together, parts = nm.scale(food, a + b), (nm.scale(food, a), nm.scale(food, b))
        for f in nm.FIELDS: assert together[f] == pytest.approx(parts[0][f] + parts[1][f], rel=1e-9, abs=1e-9)


def test_totals_are_order_independent_property():
    rng = random.Random(5)
    for _ in range(300):
        items = [{f: rng.choice([None, rng.uniform(0, 500)]) for f in nm.FIELDS} for _ in range(rng.randint(1, 8))]
        shuffled = items[:]; rng.shuffle(shuffled)
        (a, pa), (b, pb) = nm.total(items), nm.total(shuffled)
        assert nm.rounded(a) == nm.rounded(b) and pa == pb


def test_totals_report_partial_and_unknown_fields():
    totals, partial = nm.total([{"energy_kcal": 100, "protein_g": 5, "carbs_g": None, "fat_g": None}, {"energy_kcal": 50, "protein_g": None, "carbs_g": None, "fat_g": None}])
    assert totals == {"energy_kcal": 150, "protein_g": 5, "carbs_g": None, "fat_g": None} and partial == ["protein_g"]


@pytest.mark.parametrize("field,value,shown", [("energy_kcal", 77.5, 78), ("energy_kcal", 77.49, 77), ("protein_g", 0.25, 0.3), ("fat_g", 2.04, 2.0), ("carbs_g", None, None)])
def test_rounding_whole_kcal_one_decimal_macros_halves_up(field, value, shown):
    assert nm.round_value(field, value) == shown


def test_serving_units_and_unknown_piece_weight():
    assert nm.serving_grams("katori", 2) == 300 and nm.serving_grams("tablespoon", 1) == 15
    assert nm.serving_grams("piece", 3, grams_per_piece=40) == 120
    assert nm.serving_grams("piece", 3) is None  # never guessed
    with pytest.raises(ValueError): nm.serving_grams("handful")


def test_consistency_flag():
    assert nm.consistency_warning(EGG) is False
    assert nm.consistency_warning({"energy_kcal": 100, "protein_g": 10, "carbs_g": 50, "fat_g": 20}) is True
    assert nm.consistency_warning({**EGG, "fat_g": None}) is False
    assert nm.consistency_warning({"energy_kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}) is False
