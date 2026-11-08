"""A day of water, calories burned, sleep and mood kept on the account: counters add up, other fields are set,
recorded routes count, old browser days fill gaps once, and other people and other sites can't touch it."""
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from services import wellness_days as rules
from tests.test_web_gateway import browser, signed_up, post

H = {'Origin': 'http://localhost', 'Content-Type': 'application/json'}
TODAY = datetime.now(timezone.utc).date().isoformat()


def update(c, day, body, origin='http://localhost'):
    return c.post(f'/api/personalization/days/{day}', data=json.dumps(body), headers={**H, 'Origin': origin})


def test_water_goal_and_route_calories():
    assert rules.water_goal(None) == 2000 and rules.water_goal(68) == 2400 and rules.water_goal(200) == 4000 and rules.water_goal(30) == 1500
    run = SimpleNamespace(sport='run', distance_m=5000, moving_s=1800, elevation_gain_m=0)
    assert rules.route_kcal(run, 70) == pytest.approx(350)                         # about 1 kcal per kg per km
    walk = SimpleNamespace(sport='walk', distance_m=4000, moving_s=3000, elevation_gain_m=100)
    assert rules.route_kcal(walk, 70) == pytest.approx(140 + 70 * 100 * 9.81 / 4184 / 0.25)   # climbing adds
    ride = SimpleNamespace(sport='ride', distance_m=20000, moving_s=3600, elevation_gain_m=0)
    assert rules.route_kcal(ride, 70) == pytest.approx(8 * 70)                     # 20 km/h: 8 MET for an hour


def test_days_must_be_real_and_not_in_the_future():
    assert rules.check_day(TODAY, 'UTC') == TODAY
    for bad in ['2026-02-30', '1999-12-31', (datetime.now(timezone.utc).date() + timedelta(days=3)).isoformat(), 'today']:
        with pytest.raises(ValueError): rules.check_day(bad, 'UTC')


def test_a_day_through_the_gateway():
    c = browser(); signed_up(c)
    TODAY = c.get('/api/personalization/days').get_json()['today']      # the person's own today
    blank = c.get(f'/api/personalization/days/{TODAY}').get_json()
    assert blank['water_ml'] == 0 and blank['water_goal_ml'] == 2000 and blank['water_goal_basis'] == 'general' and not blank['saved'] and blank['energy'] is None
    # Two phones tapping +250 ml each: both count.
    update(c, TODAY, {'add': {'water_ml': 250}}); day = update(c, TODAY, {'add': {'water_ml': 250, 'burn_kcal': 42.5}}).get_json()
    assert day['water_ml'] == 500 and day['burn_kcal'] == 42.5 and day['burned_total'] == 43
    day = update(c, TODAY, {'set': {'sleep_hours': 7.5, 'sleep_quality': 'good', 'energy': 'great', 'sore': 'bit', 'water_goal_ml': 3000}}).get_json()
    assert (day['sleep_hours'], day['sleep_quality'], day['energy'], day['sore'], day['water_goal_ml'], day['water_goal_set']) == (7.5, 'good', 'great', 'bit', 3000, True)
    assert update(c, TODAY, {'add': {'water_ml': -5000}}).get_json()['water_ml'] == 0               # never below zero
    assert update(c, TODAY, {'set': {'water_goal_ml': None}}).get_json()['water_goal_set'] is False  # back to the worked-out goal
    # Bad values, unknown fields and impossible days are refused.
    assert update(c, TODAY, {'set': {'sleep_hours': 30}}).status_code == 422
    assert update(c, TODAY, {'set': {'mood': 'happy'}}).status_code == 422
    assert update(c, '2026-02-30', {'add': {'water_ml': 250}}).status_code == 422
    assert c.get('/api/personalization/days/not-a-day').status_code == 404
    # The last 35 days, newest first.
    recent = c.get('/api/personalization/days').get_json()
    assert len(recent['days']) == 35 and recent['days'][0]['day'] == recent['today'] and recent['days'][0]['sleep_hours'] == 7.5
    # Another site can't write; another person can't see it.
    assert update(c, TODAY, {'add': {'water_ml': 250}}, origin='https://evil.example').status_code == 403
    other = browser(); signed_up(other)
    assert other.get(f'/api/personalization/days/{TODAY}').get_json()['sleep_hours'] is None


def test_browser_days_fill_gaps_once():
    c = browser(); signed_up(c)
    TODAY = c.get('/api/personalization/days').get_json()['today']
    update(c, TODAY, {'set': {'water_ml': 1000}})
    yesterday = (datetime.fromisoformat(TODAY) - timedelta(days=1)).date().isoformat()
    body = {'days': [{'day': TODAY, 'water_ml': 750, 'steps': 4000, 'energy': 'low'}, {'day': yesterday, 'burn_kcal': 120, 'activity': 'Walk'}]}
    imp = lambda: c.post('/api/personalization/days/import', data=json.dumps(body), headers=H).get_json()['imported']
    assert imp() == 2 and imp() == 0                                                  # copying twice changes nothing
    today = c.get(f'/api/personalization/days/{TODAY}').get_json()
    assert today['water_ml'] == 1000 and today['steps'] == 4000 and today['energy'] == 'low'   # the account's water wins
    assert c.get(f'/api/personalization/days/{yesterday}').get_json()['burn_kcal'] == 120
    assert c.get('/api/personalization/days/import').status_code == 404


def test_recorded_routes_count_once():
    import database, models
    c = browser(); email, _ = signed_up(c)
    TODAY = c.get('/api/personalization/days').get_json()['today']
    with database.SessionLocal() as db:
        user = db.query(models.User).filter_by(email=email).one()
        noon = datetime.fromisoformat(TODAY + 'T12:00:00')
        common = dict(user_id=user.id, name='Run', started_at=noon - timedelta(hours=6), distance_m=5000, moving_s=1800, elapsed_s=1900, elevation_gain_m=0, stats={}, route=[])
        db.add(models.Activity(sport='run', **common))
        db.add(models.Activity(sport='run', is_deleted=True, **common))                       # deleted: not counted
        db.commit()
    day = c.get(f'/api/personalization/days/{TODAY}').get_json()
    assert day['route_kcal'] == 350 and day['burned_total'] == 350                         # 70 kg without a weigh-in
    assert c.get('/api/personalization/days').get_json()['days'][0]['route_kcal'] == 350


def test_recent_days_count_meals_from_the_diary():
    c = browser(); signed_up(c)
    TODAY = c.get('/api/personalization/days').get_json()['today']
    item = {'name': 'Idli', 'grams': 100, 'nutrients': {'calories': 120, 'protein': 4, 'carbs': 24, 'fat': 1}, 'manual_override': True, 'source': 'User reviewed input'}
    assert post(c, '/api/wellness/diary', {'id': '7b1f4a52-7c0e-4bd4-9d0e-1f2a3b4c5d6e', 'day': TODAY, 'meal_type': 'breakfast', 'items': [item], 'method': 'saved'}).status_code == 200
    assert c.get('/api/personalization/days').get_json()['days'][0]['meals'] == 1
