"""From confirmed report values to a safe diet and exercise plan."""
from services import health_plan
from services.lab_parse import parse_text
from tests.test_lab_parse import TABULAR


def r(code, value, low=None, high=None):
    return {'code': code, 'value': value, 'ref_low': low, 'ref_high': high}


def test_a_typical_report_gives_a_combined_plan():
    out = health_plan.assess(parse_text(TABULAR), sex='female', diet='vegetarian')
    status = {f['code']: f['status'] for f in out['findings']}
    assert status['hba1c'] == 'high' and status['ldl'] == 'high' and status['hdl'] == 'low' and status['hemoglobin'] == 'low'
    assert status['vitamin_d'] == 'low' and status['vitamin_b12'] == 'low' and status['tsh'] == 'high'
    assert out['safety'] == 'ok' and out['plan']
    plan = out['plan']
    assert plan['targets']['fibre_g'] == 30 and plan['targets']['added_sugar_g'] == 20 and plan['targets']['sat_fat_pct'] == 7
    ex = plan['exercise']
    assert ex['post_meal_walk'] and ex['strength_days'] == 3 and ex['cardio_min'] == 200
    assert ex['intensity'] == 'moderate' and 'intervals_per_week' not in ex   # low haemoglobin caps intensity, so no intervals
    assert not any('interval' in line.lower() for line in plan['move'])     # nor any advice that contradicts it
    assert plan['retest_days'] == 60                                          # thyroid is rechecked soonest
    text = ' '.join(plan['diet'])
    assert 'ragi' in text and 'chicken' not in text and 'fish' not in text   # vegetarian
    assert out['findings'][0]['range_from'] == 'your lab'


def test_non_vegetarian_advice_includes_fish_and_eggs():
    text = ' '.join(health_plan.assess([r('triglycerides', 230), r('hemoglobin', 11)], sex='male', diet='non_veg')['plan']['diet'])
    assert 'fatty fish' in text and 'chicken' in text


def test_dangerous_values_stop_the_plan():
    out = health_plan.assess([r('glucose_fasting', 340), r('ldl', 170)])
    assert out['safety'] == 'today' and out['plan'] is None and 'today' in out['safety_message']
    assert health_plan.assess([r('hemoglobin', 6.4)], sex='female')['plan'] is None
    assert health_plan.assess([r('potassium', 6.4)])['safety'] == 'today'


def test_clearly_abnormal_values_ask_for_a_doctor_this_week_but_keep_the_plan():
    out = health_plan.assess([r('hba1c', 10.8)])
    assert out['safety'] == 'soon' and out['plan'] and 'this week' in out['safety_message']


def test_sex_specific_ranges_and_lab_ranges():
    assert health_plan.judge(r('hemoglobin', 12.5), 'male')['status'] == 'low'
    assert health_plan.judge(r('hemoglobin', 12.5), 'female')['status'] == 'normal'
    assert health_plan.judge(r('tsh', 4.4, 0.27, 4.2), 'female')['status'] == 'high'      # the lab's own range wins
    assert health_plan.judge(r('hdl', 45), 'female')['status'] == 'low' and health_plan.judge(r('hdl', 45), 'male')['status'] == 'normal'


def test_kidney_caps_protein_and_all_normal_is_reassuring():
    plan = health_plan.assess([r('creatinine', 1.6)], sex='male')['plan']
    assert plan['targets']['protein_g_per_kg'] == 0.8 and plan['exercise']['no_high_protein']
    normal = health_plan.assess([r('hba1c', 5.2), r('ldl', 90)])
    assert normal['plan']['rules'] == [] and normal['plan']['retest_days'] == 365


def test_under_18s_get_explanations_not_a_plan():
    out = health_plan.assess([r('hba1c', 6.0)], age_group='under18')
    assert out['plan'] is None and out['findings'][0]['status'] == 'high' and 'Under 18' in out['plan_note']
