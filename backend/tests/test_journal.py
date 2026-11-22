"""Phase G2: the journal totals every kind of workout and meal per day for any period, finds the best day, month and
year, and keeps planned workouts until they are done."""
import json
import uuid
from datetime import date, datetime, timedelta, timezone

import database
import models

ORIGIN = {'Origin': 'http://localhost', 'Content-Type': 'application/json'}


def _user(email):
    with database.SessionLocal() as db:
        return db.query(models.User).filter_by(email=email).one().id


def test_journal_totals_every_source_and_finds_the_bests():
    from tests.test_web_gateway import browser, signed_up
    c = browser(); email, _ = signed_up(c)
    empty = c.get('/api/wellness/journal').get_json()
    assert empty['days'] == [] and empty['totals']['workouts'] == 0 and empty['best']['workouts']['day'] is None
    today = date.fromisoformat(empty['to'])
    uid = _user(email); now = datetime.now(timezone.utc).replace(tzinfo=None)
    with database.SessionLocal() as db:
        db.add(models.WorkoutEntry(id=str(uuid.uuid4()), user_id=uid, day=str(today), name='Gym: legs', minutes=50, sets=4, reps=10))
        db.add(models.WorkoutEntry(id=str(uuid.uuid4()), user_id=uid, day=str(today - timedelta(days=2)), name='Swim', minutes=30))
        db.add(models.WorkoutEntry(id=str(uuid.uuid4()), user_id=uid, day=str(today - timedelta(days=40)), name='Long ride', minutes=120))
        db.add(models.MealLog(user_id=uid, logged_at=now, total_calories=600, total_protein_g=30))
        db.add(models.MealLog(user_id=uid, logged_at=now, total_calories=400, total_protein_g=20))
        db.commit()
    week = c.get('/api/wellness/journal').get_json()
    assert week['totals']['workouts'] == 2 and week['totals']['minutes'] == 80 and week['totals']['reps'] == 40
    assert week['totals']['meals'] == 2 and week['totals']['kcal'] == 1000 and week['totals']['active_days'] == 2
    days = {d['day']: d for d in week['days']}
    assert days[str(today)]['kinds'] == ['manual'] and days[str(today)]['protein'] == 50
    # the long ride is outside this week but is still the best day; bests look back over all recent history
    assert week['best']['workouts']['day'] == {'period': str(today - timedelta(days=40)), 'value': 120}
    assert week['best']['food']['day']['value'] == 2
    two_months = c.get(f'/api/wellness/journal?start={today - timedelta(days=60)}&end={today}').get_json()
    assert two_months['totals']['workouts'] == 3 and two_months['totals']['minutes'] == 200
    assert c.get('/api/wellness/journal?start=not-a-day').status_code == 422


def test_planned_workouts_show_until_done_and_then_count():
    from tests.test_web_gateway import browser, signed_up
    c = browser(); signed_up(c)
    today = date.fromisoformat(c.get('/api/wellness/journal').get_json()['to'])
    plan_id = str(uuid.uuid4())
    made = c.post('/api/wellness/plans', data=json.dumps({'id': plan_id, 'day': str(today), 'name': 'Gym: chest', 'minutes': 45}), headers=ORIGIN)
    assert made.status_code == 201 and made.get_json()['done'] is False
    later = c.post('/api/wellness/plans', data=json.dumps({'day': str(today + timedelta(days=3)), 'name': 'Yoga class', 'minutes': 60}), headers=ORIGIN).get_json()
    view = c.get('/api/wellness/journal').get_json()
    assert {p['name'] for p in view['plans']} == {'Gym: chest', 'Yoga class'} and view['totals']['workouts'] == 0
    assert c.post(f"/api/wellness/plans/{later['id']}/done", data="{}", headers=ORIGIN).status_code == 422      # not its day yet
    done = c.post(f'/api/wellness/plans/{plan_id}/done', data="{}", headers=ORIGIN).get_json()
    assert done['done'] is True
    after = c.get('/api/wellness/journal').get_json()
    assert after['totals']['workouts'] == 1 and after['totals']['minutes'] == 45                    # now a real workout
    assert c.delete(f"/api/wellness/plans/{later['id']}", headers={'Origin': 'http://localhost'}).status_code == 200
    assert [p['name'] for p in c.get('/api/wellness/journal').get_json()['plans']] == ['Gym: chest']
    assert c.post('/api/wellness/plans', data=json.dumps({'day': str(today + timedelta(days=500)), 'name': 'Too far'}), headers=ORIGIN).status_code == 422


def test_journal_needs_an_account_and_keeps_people_apart():
    from tests.test_web_gateway import browser, signed_up
    assert browser().get('/api/wellness/journal').status_code == 401
    a = browser(); signed_up(a); b = browser(); signed_up(b)
    today = date.fromisoformat(a.get('/api/wellness/journal').get_json()['to'])
    plan = a.post('/api/wellness/plans', data=json.dumps({'day': str(today), 'name': 'Mine'}), headers=ORIGIN).get_json()
    assert b.post(f"/api/wellness/plans/{plan['id']}/done", data="{}", headers=ORIGIN).status_code == 404
    assert b.delete(f"/api/wellness/plans/{plan['id']}", headers={'Origin': 'http://localhost'}).status_code == 404
