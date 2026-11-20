"""Trainer dashboard (flag organizer_saas): consent first, the coach sees only what the client chose, as daily summaries;
either side can stop at once; codes are one-time, expire and can't be guessed; only verified coaches; data export."""
from datetime import datetime, timedelta, timezone

import pytest

import database
import models
from tests.test_adventure import client, init
from tests.test_wellness import account, diary, session, update

CC = '/api/v1/coach-clients'


@pytest.fixture(autouse=True)
def flags(monkeypatch):
    monkeypatch.setenv('FEATURE_ORGANIZER_SAAS', 'true')


def coach():
    uid, h = account()
    with database.SessionLocal() as db:
        u = db.get(models.User, uid); u.role = models.UserRole.professional; u.email_verified = True; db.commit()
    return uid, h


def invite(h):
    r = client.post(f'{CC}/invites', headers=h); assert r.status_code == 201, r.text
    return r.json()['code']


def join(h, code, **share):
    return client.post(f'{CC}/join', headers=h, json={'code': code, 'share': {'diary': False, 'workouts': False, 'weight': False, **share}})


def weigh(h, kg, days_ago=0):
    when = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
    assert client.post('/api/v1/personalization/measurements', headers=h, json={'kind': 'weight', 'value': kg, 'unit': 'kg', 'recorded_at': when}).status_code == 200


def only(h_coach):
    r = client.get(CC, headers=h_coach); assert r.status_code == 200, r.text
    return r.json()['clients']


def test_needs_the_flag_and_a_verified_coach(monkeypatch):
    _, h = account()
    assert client.post(f'{CC}/invites', headers=h).status_code == 403
    monkeypatch.setenv('FEATURE_ORGANIZER_SAAS', 'false')
    _, ch = coach()
    assert client.post(f'{CC}/invites', headers=ch).status_code == 404


def test_the_coach_sees_only_what_the_client_chose():
    _, ch = coach(); _, h = account(); init(h)
    assert client.post('/api/v1/wellness/diary', headers=h, json=diary(h)).status_code == 200      # 300 kcal
    s = session(h); assert update(h, s, minutes=25).status_code == 200
    weigh(h, 71.0, days_ago=6); weigh(h, 70.2)
    r = join(h, invite(ch), diary=True)
    assert r.status_code == 201 and r.json()['coach']['share'] == {'diary': True, 'workouts': False, 'weight': False}
    [row] = only(ch)
    assert row['diary']['days_logged'] == 1 and row['diary']['average_kcal'] == 300
    assert 'workouts' not in row and 'weight' not in row
    assert 'meals' not in str(row) and 'Synthetic reviewed food' not in str(row)              # totals only, never what was eaten
    link = row['id']
    assert client.put(f'{CC}/{link}/share', headers=h, json={'diary': False, 'workouts': True, 'weight': True}).status_code == 200
    [row] = only(ch)
    assert 'diary' not in row and row['workouts']['count'] == 1 and row['workouts']['minutes'] == 25
    assert row['weight']['latest_kg'] == 70.2 and row['weight']['change_kg'] == -0.8
    detail = client.get(f'{CC}/{link}', headers=ch).json()['client']
    assert len(detail['days']) == 14


def test_either_side_can_stop_and_access_ends_at_once():
    _, ch = coach(); _, h = account(); init(h)
    join(h, invite(ch), diary=True)
    link = client.get(f'{CC}/mine', headers=h).json()['coaches'][0]['id']
    assert client.request('DELETE', f'{CC}/{link}', headers=h).json()['status'] == 'ended'
    assert only(ch) == [] and client.get(f'{CC}/{link}', headers=ch).status_code == 404
    _, h2 = account(); join(h2, invite(ch), weight=True)
    link2 = only(ch)[0]['id']
    assert client.request('DELETE', f'{CC}/{link2}', headers=ch).status_code == 200
    assert client.get(f'{CC}/mine', headers=h2).json()['coaches'] == []


def test_codes_are_one_time_expire_and_need_a_choice():
    uid, ch = coach(); _, h = account(); _, other = account()
    code = invite(ch)
    assert join(h, code).status_code == 422                                   # nothing chosen
    assert join(h, code.lower().replace('-', ' '), weight=True).status_code == 201   # typed loosely: still the same code
    assert join(other, code, weight=True).status_code == 404                  # used
    old = invite(ch)
    with database.SessionLocal() as db:
        row = db.query(models.CoachClient).filter_by(coach_id=uid, status='invited').order_by(models.CoachClient.created_at.desc()).first()
        row.invite_expires_at = datetime.utcnow() - timedelta(minutes=1); db.commit()
    assert join(other, old, weight=True).status_code == 404
    assert join(ch, invite(ch), weight=True).status_code == 409               # a coach can't follow themselves


def test_guessing_codes_is_rate_limited():
    _, h = account()
    codes = [join(h, f'ZZZZ-{i:04d}', weight=True).status_code for i in range(11)]
    assert codes[:10] == [404] * 10 and codes[10] == 429


def test_other_coaches_and_clients_cannot_see_a_link():
    _, ch = coach(); _, other_coach = coach(); _, h = account(); _, stranger = account()
    join(h, invite(ch), diary=True)
    link = only(ch)[0]['id']
    assert client.get(f'{CC}/{link}', headers=other_coach).status_code == 404
    assert client.put(f'{CC}/{link}/share', headers=stranger, json={'diary': True}).status_code == 404
    assert client.request('DELETE', f'{CC}/{link}', headers=stranger).status_code == 404


def test_the_export_lists_the_links_but_never_the_code():
    _, ch = coach(); _, h = account()
    join(h, invite(ch), workouts=True)
    mine = client.get('/api/v1/users/export', headers=h).json()['account_records']['coaches_you_share_with']
    theirs = client.get('/api/v1/users/export', headers=ch).json()['account_records']['clients_you_coach']
    assert mine[0]['share'] == {'diary': False, 'workouts': True, 'weight': False} and 'invite_hash' not in mine[0]
    assert any(r['status'] == 'active' for r in theirs)


def test_the_browser_routes():
    from tests.test_web_gateway import browser, post as gpost, signed_up
    person = browser(); signed_up(person)
    assert person.get('/api/coach-clients/mine').get_json() == {'coaches': []}
    assert gpost(person, '/api/coach-clients/join', {'code': 'ABCD-EFGH', 'share': {'diary': True}}).status_code == 404
    assert person.get('/api/coach-clients').status_code == 403
    assert person.get('/api/coach-clients/not-a-link').status_code == 404
