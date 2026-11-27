"""services.meal_analysis matches frontend/web/src/lib/meal-analysis.ts (ported from meal-analysis.test.mjs)."""
import pytest

from services.meal_analysis import normalize_meal

FOOD = {'name': 'Egg', 'quantity_g': 50, 'calories': 78, 'protein_g': 6.3, 'carbs_g': 0.6, 'fat_g': 5.3, 'confidence': 0.8}


def test_totals_are_recomputed_from_components_rather_than_trusting_model_totals():
    meal = normalize_meal({'components': [FOOD, FOOD], 'total_nutrition': {'calories': 9000}}, 'test')
    assert meal['total_nutrition'] == {'calories': 156, 'protein_g': 12.6, 'carbs_g': 1.2, 'fat_g': 10.6}
    assert meal['is_mock'] is False


@pytest.mark.parametrize('result', [None, {}, [], {'components': []}, [{'name': 'Unknown'}]])
def test_empty_or_incomplete_inference_never_becomes_invented_nutrition(result):
    with pytest.raises(ValueError): normalize_meal(result, 'test')


@pytest.mark.parametrize('calories', [-1, float('nan'), float('inf'), '78', 999999, True])
def test_negative_nonfinite_and_implausible_nutrients_are_rejected(calories):
    with pytest.raises(ValueError): normalize_meal([{**FOOD, 'calories': calories}], 'test')


def test_array_output_and_zero_calorie_items_remain_valid():
    meal = normalize_meal([{**FOOD, 'name': 'Water', 'calories': 0, 'protein_g': 0, 'carbs_g': 0, 'fat_g': 0}], 'test')
    assert meal['total_nutrition']['calories'] == 0 and meal['dish_name'] == 'Water'


def test_halves_round_up_like_javascript():
    assert normalize_meal([{**FOOD, 'calories': 0.25}], 'test')['components'][0]['calories'] == 0.3


def test_dish_alternatives_pass_through_for_one_tap_correction():
    raw = {"dish_name": "Vegetable pulao", "dish_alternatives": ["Mutton biryani", " Chicken biryani ", 5, "", "Jeera rice", "Fried rice"],
           "components": [{"name": "Rice", "quantity_g": 250, "calories": 400, "protein_g": 8, "carbs_g": 70, "fat_g": 9, "confidence": .6}]}
    out = normalize_meal(raw, "test")
    assert out["alternatives"] == ["Mutton biryani", "Chicken biryani", "Jeera rice"]
    assert normalize_meal({**raw, "dish_alternatives": None}, "test")["alternatives"] == []
