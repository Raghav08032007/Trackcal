"""D1: the blood report is read correctly, every finding names its guideline, and the weekly plan follows the report."""
from datetime import date

from services import health_plan, lab_parse
from services.exercise_safety import INTENSE
from services.lab_reference import BY_CODE
from services.personalization import CARDIO, generate
from services.personalization_inputs import Preferences


def read(text):
    return {r['code']: r['value'] for r in lab_parse.parse_text(text)}


def test_a_range_printed_before_the_result_is_never_read_as_the_result():
    assert read('Haemoglobin    12.0 - 15.5    g/dL    8.6') == {'hemoglobin': 8.6}
    assert read('ALT (SGPT)    < 45    U/L    105') == {'alt': 105}


def test_flags_between_value_and_unit_keep_the_unit_so_the_value_is_converted():
    assert read('LDL Cholesterol    3.06 *    mmol/L') == {'ldl': round(3.06 * 38.67, 3)}
    assert read('Fasting Blood Sugar    10.6 H    mmol/L') == {'glucose_fasting': round(10.6 * 18, 3)}


def test_the_form_of_vitamin_d_is_not_its_level():
    assert read('25 OH Vitamin D3    57.8    ng/mL    30 - 100') == {'vitamin_d': 57.8}


def test_egfr_is_read_and_a_low_egfr_keeps_protein_and_salt_moderate():
    assert read('eGFR (CKD-EPI)    54    mL/min/1.73m2    > 60\nCreatinine 1.4 mg/dL 0.6 - 1.2') == {'egfr': 54, 'creatinine': 1.4}
    out = health_plan.assess([{'code': 'egfr', 'value': 54}])
    assert out['plan']['targets']['protein_g_per_kg'] == .8 and out['plan']['targets']['sodium_mg'] == 2000
    assert health_plan.assess([{'code': 'egfr', 'value': 12}])['safety'] == 'today'


def test_every_test_and_every_plan_rule_names_its_guideline():
    assert all(t.source for t in BY_CODE.values())
    assert set(health_plan.WHY) == set(health_plan.RULES)
    out = health_plan.assess([{'code': 'hba1c', 'value': 6.8}, {'code': 'ldl', 'value': 160}], 'female')
    assert all(f['source'] for f in out['findings'])
    assert {w['rule'] for w in out['plan']['why']} == {'sugar', 'cholesterol'} and all(w['source'] for w in out['plan']['why'])


PREFS = dict(available_days=[0, 1, 2, 3, 4, 5, 6], rest_days=[6], duration=30, experience='intermediate', interests=['fitness', 'strength'])
MONDAY = date(2026, 11, 16)


def week(report, **prefs):
    return generate(Preferences(**{**PREFS, **prefs}), MONDAY, {}, report=report)


def test_without_a_report_the_week_is_unchanged():
    assert week(None)[1]['report'] == []


def test_a_report_that_needs_a_doctor_today_leaves_only_rest():
    activities, why = week(health_plan.assess([{'code': 'glucose_fasting', 'value': 340}]))
    assert {a['template_id'] for a in activities} == {'recovery'} and 'doctor' in why['report'][0]['text']


def test_the_week_follows_the_report_with_reasons():
    report = health_plan.assess([{'code': 'hba1c', 'value': 6.9}, {'code': 'hemoglobin', 'value': 10.5}], 'female')
    activities, why = week(report)
    kinds = [a['template_id'] for a in activities if a['template_id'] != 'recovery']
    assert not set(kinds) & INTENSE and 'run' not in kinds                     # anaemia: moderate only, nothing jumping
    assert sum(1 for k in kinds if k not in CARDIO) == report['plan']['exercise']['strength_days']
    assert sum(a['minutes'] for a in activities if a['template_id'] in CARDIO) >= 90
    assert all(line['source'] for line in why['report'])
    assert any('walk after lunch' in line['text'] for line in why['report'])


def test_beginners_build_up_instead_of_starting_at_the_full_target():
    activities, why = week(health_plan.assess([{'code': 'ldl', 'value': 170}]), experience='beginner')
    assert max(a['minutes'] for a in activities) <= 20
    assert any('add a few minutes each week' in line['text'].lower() for line in why['report'])
