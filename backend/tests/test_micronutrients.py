from services.micronutrients import summarize


def row(view, slug):
    return next(r for r in view["nutrients"] if r["nutrient"] == slug)


def test_totals_scale_by_grams_and_targets_follow_sex():
    spinach = {"grams": 200, "calories": 46, "per_100g": {"iron": 2.95, "calcium": 82.3, "vitamin_c": 30.3, "sodium": 42.6}}
    view = summarize([spinach], sex="female")
    assert row(view, "iron")["amount"] == 5.9 and row(view, "iron")["target"] == 29
    assert summarize([spinach], sex="male")["nutrients"][0]["target"] == 19
    assert row(summarize([spinach]), "iron")["target"] == 24.0            # unknown sex: the average


def test_low_only_when_most_of_the_day_is_known():
    known = {"grams": 100, "calories": 300, "per_100g": {"iron": 2.0, "calcium": 100}}
    ai_meal = {"grams": 400, "calories": 700, "per_100g": None}            # an AI estimate has no micronutrient data
    partial = summarize([known, ai_meal], sex="male")
    assert partial["coverage"] == 0.3 and row(partial, "iron")["status"] == "partial"
    full = summarize([known], sex="male")
    assert row(full, "iron")["status"] == "low" and "rajma" in row(full, "iron")["sources"]
    assert row(full, "vitamin_b12")["status"] == "unknown"                 # no value at all is unknown, never zero


def test_sodium_is_a_limit():
    salty = {"grams": 100, "calories": 400, "per_100g": {"sodium": 2500, "iron": 5}}
    assert row(summarize([salty]), "sodium")["status"] == "over"
    assert row(summarize([salty]), "sodium")["sources"] == []
