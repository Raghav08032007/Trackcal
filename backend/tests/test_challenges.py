"""Phase 10: verified challenges behind `verified_challenges` (with `social_feed`). Progress only from verified
records, anti-fraud rules, completion XP once, no client-supplied numbers, validation, visibility, export."""
import uuid
from datetime import date, timedelta

import pytest

import database, models
from tests.test_adventure import client, init
from tests.test_social import member
from tests.test_wellness import diary, food, session, update

C = '/api/v1/challenges'


@pytest.fixture(autouse=True)
def flags(monkeypatch):
    for f in ('SOCIAL_FEED', 'COMMUNITIES', 'VERIFIED_CHALLENGES'): monkeypatch.setenv(f'FEATURE_{f}', 'true')


def today(): return date.today()


def challenge(h, metric='workouts', target=2, days=7, start=None, **extra):
    start = start or today()
    r = client.post(C, headers=h, json={'title': 'QA week', 'metric': metric, 'target': target, 'starts_on': str(start), 'ends_on': str(start + timedelta(days=days - 1)), 'timezone': 'UTC', **extra})
    assert r.status_code == 201, r.text
    return r.json()['challenge']


def workout(h, minutes=10, **extra):
    s = session(h); r = update(h, s, minutes=minutes, **extra); assert r.status_code == 200, r.text


def detail(h, cid):
    r = client.get(f'{C}/{cid}', headers=h); assert r.status_code == 200, r.text
    return r.json()


def test_needs_the_flag(monkeypatch):
    _, h, _ = member(); monkeypatch.setenv('FEATURE_VERIFIED_CHALLENGES', 'false')
    assert client.get(C, headers=h).status_code == 404


@pytest.mark.parametrize('bad', [
    {'target': 8, 'metric': 'meal_days'},           # more days than the challenge has
    {'target': 15, 'metric': 'workouts'},           # more than 2 a day
    {'days': 2}, {'days': 61},                      # too short, too long
    {'start': date.today() - timedelta(days=1)},    # in the past
    {'metric': 'steps'},                            # not a verified metric
])
def test_validation(bad):
    _, h, _ = member(); days = bad.pop('days', 7); start = bad.pop('start', today())
    body = {'title': 'QA', 'metric': 'workouts', 'target': 2, 'starts_on': str(start), 'ends_on': str(start + timedelta(days=days - 1)), 'timezone': 'UTC', **bad}
    assert client.post(C, headers=h, json=body).status_code == 422


def test_workouts_count_only_when_verified_and_capped_per_day():
    _, h, _ = member(); init(h)
    c = challenge(h, 'workouts', target=3)
    workout(h, minutes=5)                           # too short
    assert detail(h, c['id'])['challenge']['mine']['progress'] == 0
    for _ in range(3): workout(h)                   # only 2 a day count
    got = detail(h, c['id'])
    assert got['challenge']['mine'] == {'progress': 2, 'completed': False} and got['awarded_xp'] == 0


def test_backdated_meals_do_not_count_but_new_ones_do():
    _, h, _ = member(); init(h)
    c = challenge(h, 'meal_days', target=1, days=3)
    old = diary(h); old['day'] = str(today() - timedelta(days=1))
    assert client.post('/api/v1/wellness/diary', headers=h, json=old).status_code == 200
    assert detail(h, c['id'])['challenge']['mine']['progress'] == 0
    assert client.post('/api/v1/wellness/diary', headers=h, json=diary(h)).status_code == 200
    first = detail(h, c['id'])
    assert first['challenge']['mine'] == {'progress': 1, 'completed': True} and first['awarded_xp'] == 40
    assert detail(h, c['id'])['awarded_xp'] == 0     # paid once
    summary = client.get('/api/v1/adventure/summary', headers=h).json()
    assert any(a['code'] == 'challenge_finisher' and a['status'] == 'unlocked' for a in summary['achievements'])


def test_the_client_cannot_supply_progress_or_claim_xp():
    _, h, _ = member(); init(h)
    c = challenge(h, 'workouts', target=1)
    assert client.post(f'{C}/{c["id"]}/participation', headers=h, json={'progress': 99}).status_code in (200, 422)
    assert detail(h, c['id'])['challenge']['mine']['progress'] == 0
    assert client.post('/api/v1/adventure/activity', headers=h, json={'category': 'verified_challenge_completion', 'xp': 999}).status_code == 404


def test_large_camera_corrections_flag_for_review_without_blocking():
    from tests.test_camera import records, tracking
    owner, h, _ = member(); init(h)
    c = challenge(h, 'camera_workouts', target=1)
    s = session(h, ['camera_squat'], tracking_method='camera')
    assert update(h, s, tracking=tracking(version=2, sets=[{'estimated_reps': 3, 'corrected_reps': None}]), exercises=records(15), minutes=12).status_code == 200
    got = detail(h, c['id'])
    assert got['challenge']['mine']['completed'] is True and got['awarded_xp'] == 40
    with database.SessionLocal() as db:
        assert db.get(models.ChallengeParticipant, (c['id'], owner)).flagged is True
    assert 'flagged' not in str(got)


def test_leaving_stops_counting_and_blocks_rejoining():
    _, owner, _ = member(); _, h, _ = member(); init(h)
    c = challenge(owner, 'workouts', target=2)
    assert client.post(f'{C}/{c["id"]}/participation', headers=h).json()['challenge']['mine'] == {'progress': 0, 'completed': False}
    assert client.request('DELETE', f'{C}/{c["id"]}/participation', headers=h).json()['challenge']['mine'] is None
    workout(h)
    assert detail(h, c['id'])['challenge']['mine'] is None
    assert client.post(f'{C}/{c["id"]}/participation', headers=h).status_code == 409


def test_counts_are_shown_but_no_ranking_and_upcoming_challenges_count_nothing_yet():
    _, owner, _ = member(); _, h, _ = member(); init(h)
    c = challenge(owner, 'workouts', target=1, start=today() + timedelta(days=2))
    client.post(f'{C}/{c["id"]}/participation', headers=h); workout(h)
    got = detail(h, c['id'])['challenge']
    assert got['phase'] == 'upcoming' and got['mine']['progress'] == 0 and got['participants'] == 2 and got['finished'] == 0
    assert 'leaderboard' not in got and 'rank' not in str(got)


def test_private_community_challenges_and_limits():
    from tests.test_communities import community
    _, owner, _ = member(); _, outsider, _ = member()
    slug = community(owner, 'private')
    assert client.post(C, headers=outsider, json={'title': 'Sneaky', 'metric': 'workouts', 'target': 1, 'starts_on': str(today()), 'ends_on': str(today() + timedelta(days=4)), 'community': slug}).status_code == 403
    c = challenge(owner, community=slug)
    assert client.get(f'{C}/{c["id"]}', headers=outsider).status_code == 404
    for _ in range(4): challenge(owner)
    assert client.post(C, headers=owner, json={'title': 'Sixth', 'metric': 'workouts', 'target': 1, 'starts_on': str(today()), 'ends_on': str(today() + timedelta(days=4))}).status_code == 409


def test_cancel_and_export():
    _, owner, _ = member(); _, h, _ = member()
    c = challenge(owner)
    assert client.request('DELETE', f'{C}/{c["id"]}', headers=h).status_code == 403
    assert client.request('DELETE', f'{C}/{c["id"]}', headers=owner).json()['challenge']['phase'] == 'cancelled'
    records = client.get('/api/v1/users/export', headers=owner).json()['account_records']
    assert records['challenges_you_started'][0]['id'] == c['id'] and 'flagged' not in records['challenge_participation'][0]


def test_browser_routes():
    from tests.test_web_gateway import browser, post as gpost, signed_up
    person = browser(); signed_up(person)
    person.put('/api/social/me', json={'handle': 'qa' + uuid.uuid4().hex[:8], 'display_name': 'QA'}, headers={'Origin': 'http://localhost'})
    made = gpost(person, '/api/challenges', {'title': 'Browser week', 'metric': 'active_days', 'target': 3, 'starts_on': str(today()), 'ends_on': str(today() + timedelta(days=6)), 'timezone': 'UTC'})
    assert made.status_code == 201
    cid = made.get_json()['challenge']['id']
    assert person.get(f'/api/challenges/{cid}').status_code == 200
    assert person.get('/api/challenges?scope=mine').get_json()['challenges'][0]['id'] == cid
    assert person.get('/api/challenges/nope').status_code == 404


def test_activity_before_joining_does_not_count():
    _, owner, _ = member(); late_id, late, _ = member()
    c = challenge(owner, metric='workouts', target=1)
    workout(late)  # done before joining; stored times have one-second resolution, so move it clearly earlier
    with database.SessionLocal() as db:
        row = db.query(models.WorkoutSession).filter_by(user_id=late_id).first()
        row.completed_at -= timedelta(seconds=3); db.commit()
    assert client.post(f"{C}/{c['id']}/participation", headers=late).status_code == 200
    seen = detail(late, c['id'])
    assert seen['challenge']['mine']['progress'] == 0 and seen['awarded_xp'] == 0
    workout(late)
    assert detail(late, c['id'])['challenge']['mine']['progress'] == 1


def test_joining_twice_is_harmless():
    _, owner, _ = member(); _, h, _ = member()
    c = challenge(owner)
    assert [client.post(f"{C}/{c['id']}/participation", headers=h).status_code for _ in range(2)] == [200, 200]
    assert detail(owner, c['id'])['challenge']['participants'] == 2


def test_camera_reps_count_only_what_the_camera_saw():
    from services.challenge_progress import camera_counted
    assert camera_counted({'tracking': {'sets': [{'estimated_reps': 10, 'corrected_reps': None}, {'estimated_reps': 8, 'corrected_reps': 50}, {'estimated_reps': 12, 'corrected_reps': 9}]}}) == 27
    assert camera_counted({}) == 0 and camera_counted(None) == 0
