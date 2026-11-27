from datetime import date, timedelta

from services.adaptive_target import estimate

TODAY = date(2026, 11, 27)


def days(n, kcal):
    return {TODAY - timedelta(days=i): kcal for i in range(n)}


def weighs(start_kg, per_week, n=8, every=3):
    return [(TODAY - timedelta(days=i * every), start_kg - per_week / 7 * i * every) for i in range(n)]


def test_steady_weight_means_burn_equals_intake():
    r = estimate(days(24, 2200), weighs(70, 0.0), 2000, TODAY)
    assert r["ready"] and r["measured_burn"] == 2200 and r["burn"] == 2200 and r["trend_kg_per_week"] == 0


def test_losing_half_a_kilo_a_week_on_2000_means_burn_about_2550():
    # walking backwards in time the weight goes up by 0.5 kg a week, i.e. losing 0.5 kg/week
    r = estimate(days(24, 2000), weighs(70, -0.5), 2500, TODAY, adjustment=-500, floor=1200)
    assert r["trend_kg_per_week"] == -0.5
    assert abs(r["measured_burn"] - 2550) <= 10
    assert abs(r["suggested"] - (r["burn"] - 500)) <= 10


def test_needs_enough_logging_and_weigh_ins():
    assert estimate(days(6, 2000), weighs(70, 0), 2000, TODAY)["reason"] == "more_logging"
    assert estimate(days(20, 2000), [(TODAY, 70), (TODAY - timedelta(days=2), 70.2)], 2000, TODAY)["reason"] == "more_weighins"


def test_partly_logged_days_are_left_out_and_trust_grows():
    intake = {**days(12, 2100), **{TODAY - timedelta(days=i): 400 for i in range(12, 24)}}
    r = estimate(intake, weighs(70, 0), 2500, TODAY)
    assert r["logged_days"] == 12 and r["trust"] == round(12 / 21, 2)
    assert 2100 < r["burn"] < 2500                     # blended toward the formula while data is thin


def test_far_from_formula_asks_to_check_logging_and_stays_safe():
    r = estimate(days(24, 900), weighs(70, 0), 2400, TODAY, adjustment=-500, floor=1500)
    assert r["check_logging"] and r["burn"] >= 0.8 * 2400 and r["suggested"] >= 1500
