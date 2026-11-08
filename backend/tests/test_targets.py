"""Daily targets from the profile: the maths, the safety rules, manual overrides, and the endpoint through the gateway."""
import json
from datetime import datetime, timezone

import pytest

from services import targets
from services.personalization_inputs import Preferences

YEAR = datetime.now(timezone.utc).year


def prefs(**kw):
    base = dict(sex='female', birth_year=YEAR - 30, height_cm=162, weight_kg=68, goal='lose', pace='steady')
    return Preferences(**{**base, **kw})


def test_worked_example_woman_losing_weight():
    # BMR = 10*68 + 6.25*162 - 5*30 - 161 = 1381.5; x1.375 = 1899.6; -500 = 1399.6 -> 1400
    t = targets.compute(prefs())
    assert t['basis']['bmr'] == 1382 and t['basis']['maintenance'] == 1900 and t['calories'] == 1400
    assert t['protein'] == 109 and t['fat'] == 44 and t['carbs'] == 142        # 1.6 g/kg; 28% fat; the rest carbs
    assert t['complete'] and any('Mifflin' in line for line in t['explanation'])


def test_pace_floor_gain_and_target_reached():
    assert targets.compute(prefs(pace='gentle'))['calories'] == 1650
    assert targets.compute(prefs(pace='fast', weight_kg=52, height_cm=150, birth_year=YEAR - 60))['calories'] == 1200   # never below the floor
    man = targets.compute(prefs(sex='male', goal='gain_muscle', weight_kg=70, height_cm=175, birth_year=YEAR - 25))
    # BMR = 700 + 1093.75 - 125 + 5 = 1673.75; x1.375 = 2301.4; +350 = 2651.4 -> 2650
    assert man['calories'] == 2650 and man['protein'] == 126
    assert targets.compute(prefs(target_weight_kg=70))['basis']['adjustment'] == 0       # already at or under the target


def test_under_18s_never_get_a_deficit():
    t = targets.compute(prefs(birth_year=YEAR - 15, goal='lose'))
    assert t['basis']['adjustment'] == 0 and t['calories'] >= t['basis']['maintenance'] - 10


def test_missing_profile_gives_general_values_and_asks_for_more():
    t = targets.compute(Preferences())
    assert not t['complete'] and t['calories'] == 2000 and 'Add your age, height and weight' in t['explanation'][0]


def test_latest_weigh_in_and_report_rules_are_used():
    assert targets.compute(prefs(), latest_weight=60)['basis']['weight_kg'] == 60
    kidney = targets.compute(prefs(), report_plan={'targets': {'protein_g_per_kg': 0.8, 'fibre_g': 30, 'added_sugar_g': 20}})
    assert kidney['protein'] == 54 and kidney['fibre'] == 30 and kidney['added_sugar_max'] == 20


def test_manual_values_win_and_are_named():
    t = targets.compute(prefs(target_override={'calories': 1600, 'protein': 120}))
    assert t['calories'] == 1600 and t['protein'] == 120 and t['manual'] == ['calories', 'protein']
    with pytest.raises(ValueError):
        Preferences(target_override={'calories': 300})


def test_targets_through_the_gateway():
    from tests.test_web_gateway import browser, signed_up, post
    c = browser(); signed_up(c)
    t = c.get('/api/personalization/targets').get_json()
    assert t['calories'] == 2000 and not t['complete']
    answers = prefs().model_dump()
    assert post(c, '/api/personalization/onboarding', {'preferences': answers, 'step': 2, 'revision': 0}).status_code == 200
    t = c.get('/api/personalization/targets').get_json()
    assert t['calories'] == 1400 and t['complete']
    put = lambda body: c.put('/api/personalization/targets', data=json.dumps(body), headers={'Origin': 'http://localhost', 'Content-Type': 'application/json'})
    assert put({'calories': 1550}).get_json()['calories'] == 1550
    assert put({'calories': 200}).status_code == 422
    assert put({'calories': None}).get_json()['calories'] == 1400                 # cleared: back to calculated
    assert c.put('/api/personalization/targets', data='{}', headers={'Origin': 'https://evil.example', 'Content-Type': 'application/json'}).status_code == 403
