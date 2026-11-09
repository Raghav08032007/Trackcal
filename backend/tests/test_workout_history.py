"""One workout history: sessions, hand-logged workouts and routes together; edit, delete and undo; the training library
merging across devices; browser data copied once; and other people and other sites kept out."""
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from services import workout_history as rules
from tests.test_web_gateway import browser, signed_up, post

H = {'Origin': 'http://localhost', 'Content-Type': 'application/json'}


def today(c):
    return c.get('/api/personalization/days').get_json()['today']


def entry(c, day, name='Push day', **kw):
    body = {'id': str(uuid.uuid4()), 'day': day, 'name': name, 'minutes': 30, 'sets': 3, 'reps': 10, 'load': 20, **kw}
    return post(c, '/api/wellness/entries', body), body


def test_inputs_are_checked():
    with pytest.raises(ValueError): rules.EntryInput(day='2026-11-08', name='   ')
    with pytest.raises(ValueError): rules.EntryInput(day='2026-11-08', name='x', minutes=2000)
    with pytest.raises(ValueError): rules.ProgramDays(add=['../etc:1'])
    assert rules.EntryInput(day='2026-11-08', name='  Leg   day ').name == 'Leg day'


def test_log_edit_delete_and_undo():
    c = browser(); signed_up(c); day = today(c)
    saved, body = entry(c, day)
    assert saved.status_code == 200 and saved.get_json()['detail'] == '3 × 10 · 20 kg'
    assert post(c, '/api/wellness/entries', body).get_json()['id'] == body['id']            # the same save twice is one workout
    items = c.get('/api/wellness/history').get_json()
    assert [i['id'] for i in items['items']] == [body['id']] and items['active_days'] == [day]
    edited = c.put(f"/api/wellness/entries/{body['id']}", data=json.dumps({'day': day, 'name': 'Pull day', 'minutes': 40}), headers=H).get_json()
    assert edited['title'] == 'Pull day' and edited['minutes'] == 40 and edited['sets'] == 0
    assert c.delete(f"/api/wellness/entries/{body['id']}", headers=H).status_code == 200
    assert c.get('/api/wellness/history').get_json()['items'] == []
    assert post(c, f"/api/wellness/entries/{body['id']}/restore", {}).get_json()['title'] == 'Pull day'
    assert len(c.get('/api/wellness/history?kind=manual').get_json()['items']) == 1
    assert c.get('/api/wellness/history?kind=route').get_json()['items'] == []
    # Bad input, future days, other people and other sites.
    tomorrow3 = (datetime.fromisoformat(day) + timedelta(days=3)).date().isoformat()
    assert entry(c, tomorrow3)[0].status_code == 422
    assert entry(c, day, name='')[0].status_code == 422
    assert c.get('/api/wellness/history?kind=everything').status_code == 422
    other = browser(); signed_up(other)
    assert other.get('/api/wellness/history').get_json()['items'] == []
    assert other.delete(f"/api/wellness/entries/{body['id']}", headers=H).status_code == 404
    assert post(c, '/api/wellness/entries', {**body, 'id': str(uuid.uuid4())}, origin='https://evil.example').status_code == 403


def test_sessions_and_routes_join_the_history_newest_first():
    import database, models
    c = browser(); email, _ = signed_up(c); day = today(c)
    entry(c, day, name='Stretch', sets=0, reps=0, load=0)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with database.SessionLocal() as db:
        user = db.query(models.User).filter_by(email=email).one()
        session = models.WorkoutSession(id=str(uuid.uuid4()), user_id=user.id, name='Camera squats', status='completed', recorded_minutes=6,
                                        details={'tracking_method': 'camera', 'exercises': [{'exercise_id': 'camera_squat', 'sets': [{'reps': 12, 'load': 0, 'minutes': 0}, {'reps': 10, 'load': 0, 'minutes': 0}]}]},
                                        started_at=now - timedelta(minutes=50), completed_at=now - timedelta(minutes=40))
        route = models.Activity(user_id=user.id, sport='run', name='Morning run', started_at=now - timedelta(minutes=20), distance_m=5230, moving_s=1800, elapsed_s=1900, elevation_gain_m=12, stats={}, route=[])
        db.add_all([session, route]); db.commit(); session_id = session.id
    items = c.get('/api/wellness/history').get_json()['items']
    kinds = {i['kind']: i for i in items}
    assert set(kinds) == {'camera', 'manual', 'route'}
    assert kinds['camera']['detail'] == '2 sets · 22 reps' and kinds['camera']['exercises'] == ['Camera squat practice']
    assert kinds['route']['detail'] == '5.23 km · 12 m climb' and kinds['route']['link'].startswith('/activity?id=')
    assert [i['at'] for i in items] == sorted([i['at'] for i in items], reverse=True)
    assert [i['kind'] for i in c.get('/api/wellness/history?kind=camera').get_json()['items']] == ['camera']
    # Paging covers every item once.
    first = c.get('/api/wellness/history?limit=2').get_json(); rest = c.get('/api/wellness/history?limit=2&offset=2').get_json()
    assert first['has_more'] and not rest['has_more'] and len({i['id'] for i in first['items'] + rest['items']}) == 3
    # A deleted session can be brought back.
    assert c.delete(f'/api/wellness/sessions/{session_id}', headers=H).status_code == 200
    assert 'camera' not in {i['kind'] for i in c.get('/api/wellness/history').get_json()['items']}
    assert post(c, f'/api/wellness/sessions/{session_id}/restore', {}).get_json()['kind'] == 'camera'


def test_library_merges_changes_from_two_devices():
    c = browser(); signed_up(c)
    lib = lambda body: post(c, '/api/wellness/library', body).get_json()
    circuit = {'id': 'c1', 'name': 'Quick legs', 'rest': 30, 'steps': [{'kind': 'squat', 'target': 12}]}
    lib({'save_circuits': [circuit]})
    lib({'program_days': {'add': ['starter-strength:0']}})                       # from another phone, without the circuit
    state = lib({'program_days': {'add': ['starter-strength:1', 'starter-strength:0']}, 'next_targets': [{'kind': 'squat', 'target': 14}]})
    assert state['circuits'] == [circuit] and state['program_days'] == ['starter-strength:0', 'starter-strength:1'] and state['next_targets'] == [{'kind': 'squat', 'target': 14}]
    state = lib({'program_days': {'clear': ['starter-strength']}, 'remove_circuits': ['c1']})
    assert state['circuits'] == [] and state['program_days'] == []
    assert post(c, '/api/wellness/library', {'save_circuits': [{**circuit, 'steps': []}]}).status_code == 422
    assert c.get('/api/wellness/library/import').status_code == 404


def test_browser_training_data_is_copied_once():
    c = browser(); signed_up(c); day = today(c)
    w = {'id': str(uuid.uuid4()), 'day': day, 'name': 'Old log', 'minutes': 20, 'sets': 0, 'reps': 0, 'load': 0, 'source': 'Manual entry'}
    body = {'workouts': [w], 'circuits': [{'id': 'old', 'name': 'Old circuit', 'rest': 20, 'steps': [{'kind': 'jack', 'target': 20}]}],
            'program_days': ['starter-strength:0'], 'next_targets': [{'kind': 'squat', 'target': 11}]}
    first = post(c, '/api/wellness/library/import', body).get_json()
    second = post(c, '/api/wellness/library/import', body).get_json()
    assert first['workouts'] == 1 and second['workouts'] == 0
    assert len(second['circuits']) == 1 and second['program_days'] == ['starter-strength:0']
    assert [i['title'] for i in c.get('/api/wellness/history').get_json()['items']] == ['Old log']


def test_a_copied_workout_is_never_lost_to_an_id_clash():
    shared = str(uuid.uuid4())
    for _ in range(2):
        c = browser(); signed_up(c); day = today(c)
        body = {'workouts': [{'id': shared, 'day': day, 'name': 'Old swim', 'minutes': 30, 'sets': 0, 'reps': 0, 'load': 0, 'source': 'Manual entry'}]}
        assert post(c, '/api/wellness/library/import', body).get_json()['workouts'] == 1
        assert [i['title'] for i in c.get('/api/wellness/history').get_json()['items']] == ['Old swim']
