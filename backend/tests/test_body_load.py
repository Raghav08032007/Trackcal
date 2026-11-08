"""Surgeries and injuries marked at sign-up protect that part of the body in every generated plan."""
from datetime import date

import pytest

from services import body_load, personalization as rules
from services.personalization_inputs import Preferences

HOME = dict(setting='home', equipment=['mat', 'chair', 'dumbbells'], interests=['strength', 'fitness'])


def eligible(*conditions):
    return set(rules.eligible_templates(Preferences(conditions=list(conditions), **HOME), include_camera=True))


def test_every_workout_has_a_load_map():
    assert set(rules.TEMPLATES) <= set(body_load.LOADS)


@pytest.mark.parametrize('condition,expected', [
    ({'part': 'knee_r', 'kind': 'surgery', 'when': 'under6w'}, 'avoid'),
    ({'part': 'knee_r', 'kind': 'surgery', 'when': '6to12w', 'cleared': False}, 'avoid'),
    ({'part': 'knee_r', 'kind': 'surgery', 'when': '6to12w', 'cleared': True}, 'healing'),
    ({'part': 'knee_r', 'kind': 'injury', 'when': 'under6w'}, 'avoid'),
    ({'part': 'knee_r', 'kind': 'injury', 'when': '3to12m'}, 'healing'),
    ({'part': 'knee_r', 'kind': 'surgery', 'when': 'over1y', 'status': 'recovered'}, 'recovered'),
    ({'part': 'knee_r', 'kind': 'pain', 'when': 'over1y', 'status': 'avoid'}, 'avoid'),
])
def test_stages(condition, expected):
    assert body_load.stage(Preferences(conditions=[condition]).conditions[0]) == expected


def test_recent_knee_surgery_rules_out_everything_on_the_knee_but_keeps_the_upper_body():
    left = eligible({'part': 'knee_l', 'kind': 'surgery', 'when': 'under6w'})
    assert not left & {'camera_squat', 'camera_lunge', 'camera_jack', 'run', 'walk', 'camera_legext'}
    assert {'camera_curl', 'camera_press', 'camera_raise'} <= left


def test_a_healing_knee_keeps_light_work_and_drops_heavy_and_impact():
    left = eligible({'part': 'knee_r', 'kind': 'injury', 'when': '3to12m', 'status': 'healing'})
    assert 'walk' in left and 'camera_legcurl' in left
    assert not left & {'camera_squat', 'camera_lunge', 'run', 'camera_squatjump', 'camera_nordic'}


def test_shoulder_and_lower_back():
    shoulder = eligible({'part': 'shoulder_l', 'kind': 'surgery', 'when': 'under6w'})
    assert not shoulder & {'camera_pushup', 'camera_press', 'camera_pullup', 'camera_raise', 'camera_burpee'}
    assert 'camera_squat' in shoulder
    back = eligible({'part': 'lower_back', 'kind': 'injury', 'when': '3to12m'})
    assert not back & {'camera_deadlift', 'camera_rdl', 'camera_row', 'camera_superman'}
    assert 'camera_bridge' in back  # light on the lower back


def test_a_recovered_part_limits_nothing_and_the_plan_explains_itself():
    assert eligible({'part': 'knee_r', 'kind': 'surgery', 'when': 'over1y', 'status': 'recovered'}) == eligible()
    prefs = Preferences(conditions=[{'part': 'knee_r', 'kind': 'surgery', 'when': 'under6w'}], available_days=[0, 1, 2, 3, 4, 5, 6], rest_days=[], **HOME)
    activities, explanation = rules.generate(prefs, date(2026, 11, 9), {})
    assert activities and not any(a['template_id'] in {'camera_squat', 'run', 'walk'} for a in activities)
    assert explanation['protected'] == ['Nothing that loads your knee while it heals.']


def test_sign_up_rules():
    assert Preferences(birth_year=2012, goal='lose', target_weight_kg=40).model_dump()['target_weight_kg'] is None
    young = Preferences(birth_year=2012, goal='lose')
    assert young.age_group == 'under18' and young.goal == 'fit'
    assert Preferences(birth_year=1990).age_group == '20_64'
    with pytest.raises(ValueError):
        Preferences(conditions=[{'part': 'knee_r'}, {'part': 'knee_r'}])
    with pytest.raises(ValueError):
        Preferences(birth_year=2024)
    assert Preferences(language='ml', state='Kerala', cuisine='kerala', diet='jain', fasting=['ekadashi']).language == 'ml'
