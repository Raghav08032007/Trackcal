"""Exercise safety: what the app advises against (injuries, surgeries, a blood report's limit), in plain words, and the person's
own recorded decision to go ahead anyway. Other people and other sites are kept out."""
import json

from services import exercise_safety
from services.personalization_inputs import Condition, Preferences
from tests.test_web_gateway import browser, signed_up, post


def test_a_resting_knee_rules_out_squats_and_jumps_but_not_curls():
    out = exercise_safety.check([Condition(part='knee_r', kind='surgery', when='under6w')])['exercises']
    assert out['camera_squat']['level'] == 'avoid' and 'knee' in out['camera_squat']['reasons'][0] and 'surgery in the last 6 weeks' in out['camera_squat']['reasons'][0]
    assert out['camera_squatjump']['level'] == 'avoid'
    assert 'camera_curl' not in out


def test_a_healing_part_rules_out_heavy_work_and_asks_care_with_light_work():
    out = exercise_safety.check([Condition(part='shoulder_l', kind='injury', when='3to12m', status='healing')])['exercises']
    assert out['camera_pushup']['level'] == 'avoid'                       # works the shoulder hard
    assert out['camera_plank']['level'] == 'caution' and 'gently' in out['camera_plank']['reasons'][0]
    assert 'camera_squat' not in out


def test_recovered_parts_and_no_conditions_change_nothing():
    assert exercise_safety.check([Condition(part='knee_l', status='recovered')])['exercises'] == {}
    assert exercise_safety.check([])['exercises'] == {}


def test_a_blood_report_limit_flags_high_intensity_moves():
    out = exercise_safety.check([], 'moderate')
    assert out['report_limit'] == 'moderate' and out['exercises']['camera_burpee']['level'] == 'caution'
    assert 'blood report' in out['exercises']['camera_burpee']['reasons'][0] and 'camera_squat' not in out['exercises']


def test_through_the_gateway_with_a_recorded_decision():
    c = browser(); signed_up(c)
    prefs = Preferences(conditions=[Condition(part='knee_r', kind='injury', when='under6w')]).model_dump()
    assert post(c, '/api/personalization/onboarding', {'preferences': prefs, 'step': 2, 'revision': 0}).status_code == 200
    state = c.get('/api/personalization/exercise-safety').get_json()
    assert state['exercises']['camera_squat']['level'] == 'avoid' and state['protected'] == {'knee': 'avoid'}
    assert post(c, '/api/personalization/exercise-ack', {'template': 'camera_squat', 'accepted': False}).status_code == 422
    done = post(c, '/api/personalization/exercise-ack', {'template': 'camera_squat', 'accepted': True}).get_json()
    assert done['status'] == 'recorded' and done['level'] == 'avoid'
    assert post(c, '/api/personalization/exercise-ack', {'template': 'camera_curl', 'accepted': True}).get_json()['status'] == 'not_needed'
    export = c.get('/api/account/export').get_json()
    acks = export['personalization']['safety_acknowledgements']
    assert len(acks) == 1 and acks[0]['template'] == 'camera_squat' and 'knee' in json.dumps(acks[0]['reasons'])
    assert post(c, '/api/personalization/exercise-ack', {'template': 'camera_squat', 'accepted': True}, origin='https://evil.example').status_code == 403
    other = browser(); signed_up(other)
    assert other.get('/api/personalization/exercise-safety').get_json()['exercises'] == {}
