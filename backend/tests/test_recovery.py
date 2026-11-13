"""D2: day-by-day recovery stories. Stages only move up on steady low pain, pause at once on a warning sign or high pain, and never
shorten the rest a recent operation or injury needs."""
from datetime import date, timedelta

from services import body_load
from services.personalization_inputs import Condition
from services.recovery import effective_conditions, evaluate

TODAY = date(2026, 11, 20)


def days(*pains, trend='same', flags_on=None, end=TODAY):
    """Check-ins on consecutive days ending today; pains oldest first."""
    out = []
    for i, pain in enumerate(pains):
        day = end - timedelta(days=len(pains) - 1 - i)
        out.append({'day': day.isoformat(), 'pain': pain, 'trend': trend, 'red_flags': ['numbness'] if flags_on == i else []})
    return out


SORE_KNEE = Condition(part='knee_r', kind='pain', when='3to12m', status='avoid')        # the person chose to rest it
HEALING_BACK = Condition(part='lower_back', kind='injury', when='3to12m', status='healing')
NEW_SURGERY = Condition(part='shoulder_l', kind='surgery', when='under6w', status='healing')


def test_steady_low_pain_eases_back_then_recovers():
    assert evaluate(SORE_KNEE, days(3, 2, 2), TODAY)['stage'] == 'avoid'                # only 2 steady days so far
    assert evaluate(SORE_KNEE, days(2, 2, 1), TODAY)['stage'] == 'healing'             # 3 days at 2 or less: easing back
    assert evaluate(SORE_KNEE, days(*[1] * 7), TODAY)['stage'] == 'recovered'          # 7 days at 1 or less
    assert evaluate(HEALING_BACK, days(*[1] * 6), TODAY)['stage'] == 'healing'         # one day short
    assert evaluate(HEALING_BACK, days(*[0] * 7), TODAY)['stage'] == 'recovered'


def test_a_gap_in_the_days_restarts_the_count():
    gappy = days(1, 1, 1, end=TODAY - timedelta(days=5)) + days(1, 1, 1, 1)   # no check-in 4 days ago
    assert evaluate(HEALING_BACK, gappy, TODAY)['stage'] == 'healing'


def test_high_pain_or_a_warning_sign_pauses_at_once_and_says_see_a_doctor():
    for history in (days(1, 1, 1, 1, 1, 1, 8), days(0, 0, 0, 0, 0, 0, 1, flags_on=6)):
        out = evaluate(HEALING_BACK, history, TODAY)
        assert out['stage'] == 'avoid' and out['alert'] == 'doctor' and 'doctor' in out['advice']


def test_getting_worse_twice_steps_back_one_stage():
    out = evaluate(HEALING_BACK, days(2, 4, 6), TODAY)
    assert out['stage'] == 'avoid' and out['alert'] == 'physio'
    recovered = Condition(part='ankle_l', kind='injury', when='over1y', status='recovered')
    assert evaluate(recovered, days(1, 3, 5), TODAY)['stage'] == 'healing'


def test_moderate_pain_on_a_recovered_part_means_light_work_only():
    recovered = Condition(part='ankle_l', kind='injury', when='over1y', status='recovered')
    assert evaluate(recovered, days(4), TODAY)['stage'] == 'healing'
    assert evaluate(recovered, days(1), TODAY)['stage'] == 'recovered'


def test_check_ins_never_shorten_rest_after_recent_surgery():
    out = evaluate(NEW_SURGERY, days(*[0] * 10), TODAY)
    assert out['stage'] == 'avoid' and 'cleared' in out['reason']


def test_old_check_ins_do_not_keep_a_pause_forever():
    stale = days(9, end=TODAY - timedelta(days=5))
    assert evaluate(HEALING_BACK, stale, TODAY)['alert'] is None


def test_the_stage_reaches_every_place_that_protects_body_parts():
    paused = effective_conditions([HEALING_BACK], {'lower_back': days(8)}, TODAY)
    assert body_load.protected(paused) == {'lower_back': 'avoid'}
    eased = effective_conditions([SORE_KNEE], {'knee_r': days(1, 1, 2)}, TODAY)
    assert body_load.protected(eased) == {'knee': 'healing'}
    done = effective_conditions([SORE_KNEE], {'knee_r': days(*[0] * 7)}, TODAY)
    assert body_load.protected(done) == {}


def test_check_ins_through_the_gateway_move_the_stage_everywhere():
    from services.personalization_inputs import Preferences
    from tests.test_web_gateway import browser, post, signed_up
    c = browser(); signed_up(c)
    prefs = Preferences(conditions=[Condition(part='lower_back', kind='injury', when='3to12m', status='healing')]).model_dump()
    assert post(c, '/api/personalization/onboarding', {'preferences': prefs, 'step': 2, 'revision': 0}).status_code == 200
    assert c.get('/api/personalization/exercise-safety').get_json()['protected'] == {'lower_back': 'healing'}
    out = post(c, '/api/personalization/pain-checkin', {'part': 'lower_back', 'pain': 8, 'trend': 'worse', 'red_flags': []})
    assert out.status_code == 200
    part = out.get_json()['parts'][0]
    assert part['stage'] == 'avoid' and part['alert'] == 'doctor' and part['checked_today']
    assert c.get('/api/personalization/exercise-safety').get_json()['protected'] == {'lower_back': 'avoid'}
    # Same day again: the check-in is replaced, not added.
    again = post(c, '/api/personalization/pain-checkin', {'part': 'lower_back', 'pain': 2, 'trend': 'better', 'red_flags': []}).get_json()
    assert len(again['parts'][0]['history']) == 1 and again['parts'][0]['alert'] is None
    # Parts not on the profile and unknown warning signs are refused.
    assert post(c, '/api/personalization/pain-checkin', {'part': 'knee_l', 'pain': 2, 'trend': 'same'}).status_code == 422
    assert post(c, '/api/personalization/pain-checkin', {'part': 'lower_back', 'pain': 2, 'trend': 'same', 'red_flags': ['hiccups']}).status_code == 422
