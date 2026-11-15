"""Phase G: weekly summary and fitness trend. Effort is minutes x METs from the Compendium; the WHO guideline is 600-1200 MET-minutes
a week; fitness and fatigue are 42- and 7-day weighted averages; a sudden jump is flagged. Through the web gateway: totals only,
a GPS activity recorded inside a workout is counted once, and nobody sees anyone else's trend."""
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

import database, models
from services import training_load as tl
from tests.test_activities_helpers import fixes_for
from tests.test_web_gateway import browser, post, signed_up

TODAY = date(2026, 11, 15)   # a Sunday


def items(days, minutes=30, met=4.0, kind='walk'):
    return [(TODAY - timedelta(days=d), minutes, met, kind, 0) for d in days]


def test_effort_follows_the_compendium():
    assert tl.activity_met('run', 9656, 3600) == pytest.approx(9.8, abs=0.05)        # 6 mph, Compendium 12050
    assert tl.activity_met('run', 8000, 3600) == pytest.approx(8.3, abs=0.05)
    assert tl.activity_met('ride', 20000, 3600) == pytest.approx(8.2, abs=0.3)      # 20 km/h
    assert tl.activity_met('walk', 5000, 3600) == pytest.approx(3.7, abs=0.2)       # 5 km/h
    assert tl.activity_met('hike', 3000, 3600) == 6.0
    assert tl.session_met({'exercises': [{'exercise_id': 'yoga'}]}, {'yoga': 'yoga'}) == (2.5, 'mobility')
    assert tl.session_met({'exercises': [{'exercise_id': 'gym'}, {'exercise_id': 'yoga'}]}, {}) == (5.0, 'strength')
    assert tl.session_met({'tracking': {'exercise_type': 'burpee'}}, {})[0] == 8.0
    assert tl.session_met({'tracking': {'exercise_type': 'curl'}}, {})[0] == 3.8
    assert tl.entry_met('Morning jog') == (8.3, 'run') and tl.entry_met('Leg day at the gym')[0] == 5.0 and tl.entry_met('Gardening') == (4.0, 'other')


def test_weeks_run_monday_to_sunday_and_the_who_guideline_is_judged_on_this_week():
    s = tl.summarise(items(range(0, 7), minutes=30, met=4.0), TODAY)           # 7 x 120 MET-minutes this week
    assert len(s['weeks']) == 12 and s['weeks'][-1]['start'] == '2026-11-09'
    week = s['weeks'][-1]
    assert week['met_minutes'] == 840 and week['minutes'] == 210 and week['active_days'] == 7 and week['by_kind'] == {'walk': 840}
    assert s['guideline']['status'] == 'met' and s['guideline']['days_into_week'] == 7
    low = tl.summarise(items([0], minutes=20, met=4.3), TODAY)['guideline']
    assert low['status'] == 'building' and '514 MET-minutes' in low['text'] and '120 minutes of brisk walking' in low['text']
    assert tl.summarise(items(range(0, 7), minutes=50, met=4.0), TODAY)['guideline']['status'] == 'more'


def test_the_trend_waits_for_enough_history_then_flags_a_sudden_jump():
    early = tl.summarise(items([0, 1, 2]), TODAY)['trend']
    assert early['enough_history'] is False and early['ratio'] is None and 'three weeks' in early['message']
    steady = tl.summarise(items(range(0, 42, 2)), TODAY)['trend']
    assert steady['enough_history'] and 0.8 <= steady['ratio'] <= 1.3 and steady['message'].startswith('Steady')
    jump = tl.summarise(items(range(7, 42, 3), minutes=20) + items(range(0, 7), minutes=60), TODAY)['trend']
    assert jump['ratio'] > 1.5 and 'injuries' in jump['message']
    assert jump['fatigue'] > jump['fitness'] and jump['form'] < 0                   # a hard week: tired, fitness still catching up
    rest = tl.summarise(items(range(14, 42)), TODAY)['trend']
    assert rest['ratio'] < 0.8 and rest['message'].startswith('Lighter')
    assert len(rest['days']) == 84 and rest['days'][-1]['day'] == TODAY.isoformat()


def test_fitness_and_fatigue_are_weighted_averages_with_their_own_time_constants():
    loads = [100.0] * 300
    assert tl.ewma(loads, 42)[-1] == pytest.approx(100, rel=0.01)                  # settles on a steady load
    one = tl.ewma([100.0] + [0.0] * 42, 42)
    assert one[42] == pytest.approx(one[0] * (1 - (1 - __import__('math').exp(-1 / 42))) ** 42, rel=1e-9)
    fat, fit = tl.ewma([100.0] + [0.0] * 7, 7), tl.ewma([100.0] + [0.0] * 7, 42)
    assert fat[-1] / fat[0] < fit[-1] / fit[0]                                      # fatigue fades faster than fitness


def test_the_endpoint_counts_workouts_routes_and_logs_once_each_and_only_for_their_owner():
    c = browser()
    signed_up(c)
    started = (datetime.now(timezone.utc) - timedelta(hours=3))
    run = post(c, '/api/activities', {'sport': 'run', 'started_at': started.isoformat(), 'fixes': fixes_for([(1200, 10 / 3)])})
    assert run.status_code == 201, run.get_data(as_text=True)
    activity = run.get_json()['activity']
    with database.SessionLocal() as db:
        user_id = db.get(models.Activity, activity['id']).user_id
        session = models.WorkoutSession(id=str(uuid.uuid4()), user_id=user_id, name='Morning run', status='completed', details={'exercises': [{'exercise_id': 'run', 'sets': []}]},
                                        active_seconds=1200, recorded_minutes=20, started_at=started.replace(tzinfo=None), running_since=None,
                                        completed_at=(started + timedelta(minutes=20)).replace(tzinfo=None))
        gym = models.WorkoutSession(id=str(uuid.uuid4()), user_id=user_id, name='Gym', status='completed', details={'exercises': [{'exercise_id': 'gym', 'sets': []}]},
                                    active_seconds=1800, recorded_minutes=30, started_at=started.replace(tzinfo=None), running_since=None,
                                    completed_at=(started + timedelta(minutes=40)).replace(tzinfo=None))
        db.add_all([session, gym]); db.flush()
        db.get(models.Activity, activity['id']).session_id = session.id      # the run was recorded inside that workout
        db.commit()
    today = c.get('/api/personalization/days').get_json()['today']
    assert post(c, '/api/wellness/entries', {'id': str(uuid.uuid4()), 'day': today, 'name': 'Evening yoga', 'minutes': 40}).status_code in (200, 201)
    r = c.get('/api/wellness/trend?weeks=8')
    assert r.status_code == 200, r.get_data(as_text=True)
    body = r.get_json()
    week = body['weeks'][-1]
    assert len(body['weeks']) == 8 and week['sessions'] == 3                       # run (once), gym, yoga
    run_load = round(activity['moving_s'] / 60 * tl.activity_met('run', activity['distance_m'], activity['moving_s']))
    assert week['met_minutes'] == pytest.approx(run_load + 30 * 5.0 + 40 * 2.5, abs=2)
    assert week['distance_m'] == pytest.approx(activity['distance_m'], abs=1) and set(week['by_kind']) == {'run', 'strength', 'mobility'}
    assert 'route' not in str(body) and 'Compendium' in body['method']
    other = browser()
    signed_up(other)
    assert other.get('/api/wellness/trend').get_json()['weeks'][-1]['sessions'] == 0
    assert browser().get('/api/wellness/trend').status_code == 401
