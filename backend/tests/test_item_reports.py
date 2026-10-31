"""Reporting events and challenges: the shared queue, hiding at three reports, moderator decisions, paused accounts."""
from datetime import date, timedelta

import pytest

import database, models
from tests.test_adventure import client
from tests.test_challenges import challenge
from tests.test_events import event
from tests.test_social import member

R, M, E, C = '/api/v1/social/reports', '/api/v1/social/moderation', '/api/v1/events', '/api/v1/challenges'


@pytest.fixture(autouse=True)
def flags(monkeypatch):
    for f in ('SOCIAL_FEED', 'COMMUNITIES', 'VERIFIED_EVENTS', 'VERIFIED_CHALLENGES'): monkeypatch.setenv(f'FEATURE_{f}', 'true')


def report(h, kind, ident, reason='spam'):
    return client.post(R, headers=h, json={'target_type': kind, 'target_id': ident, 'reason': reason})


def moderator():
    uid, h, _ = member()
    with database.SessionLocal() as db:
        db.get(models.User, uid).role = models.UserRole.admin; db.commit()
    return h


def item(kind):
    _, owner, _ = member()
    return owner, (event(owner) if kind == 'event' else challenge(owner))


def path(kind, row): return f"{E if kind == 'event' else C}/{row['id']}"


@pytest.mark.parametrize('kind', ['event', 'challenge'])
def test_three_people_hide_an_item_from_everyone_but_its_owner(kind):
    owner, row = item(kind); _, viewer, _ = member()
    for _ in range(2):
        assert report(member()[1], kind, row['id']).status_code == 201
    assert client.get(path(kind, row), headers=viewer).status_code == 200
    assert report(member()[1], kind, row['id']).status_code == 201
    assert client.get(path(kind, row), headers=viewer).status_code == 404
    listed = client.get(E if kind == 'event' else C, headers=viewer).json()
    assert row['id'] not in [x['id'] for x in listed['events' if kind == 'event' else 'challenges']]
    seen = client.get(path(kind, row), headers=owner).json()['event' if kind == 'event' else 'challenge']
    assert seen['hidden'] is True


@pytest.mark.parametrize('kind', ['event', 'challenge'])
def test_one_person_reporting_repeatedly_counts_once(kind):
    _, row = item(kind); _, h, _ = member()
    for _ in range(3): report(h, kind, row['id'])
    assert client.get(path(kind, row), headers=member()[1]).status_code == 200


@pytest.mark.parametrize('kind', ['event', 'challenge'])
def test_moderators_see_the_item_and_can_restore_it(kind):
    _, row = item(kind); mod = moderator()
    for _ in range(3): report(member()[1], kind, row['id'])
    queue = client.get(M, headers=mod).json()['queue']
    entry = next(q for q in queue if q['target_id'] == row['id'])
    assert entry['hidden'] is True and row['title'] in entry['content']
    assert client.post(M, headers=mod, json={'target_type': kind, 'target_id': row['id'], 'action': 'restore'}).status_code == 200
    assert client.get(path(kind, row), headers=member()[1]).status_code == 200


@pytest.mark.parametrize('kind', ['event', 'challenge'])
def test_a_moderator_can_hide_an_item_directly(kind):
    _, row = item(kind); mod = moderator(); report(member()[1], kind, row['id'])
    assert client.post(M, headers=mod, json={'target_type': kind, 'target_id': row['id'], 'action': 'hide'}).status_code == 200
    assert client.get(path(kind, row), headers=member()[1]).status_code == 404


def test_restoring_never_revives_a_cancelled_event():
    owner, row = item('event'); mod = moderator(); report(member()[1], 'event', row['id'])
    assert client.request('DELETE', path('event', row), headers=owner).status_code == 200
    client.post(M, headers=mod, json={'target_type': 'event', 'target_id': row['id'], 'action': 'hide'})
    client.post(M, headers=mod, json={'target_type': 'event', 'target_id': row['id'], 'action': 'restore'})
    assert client.get(path('event', row), headers=owner).json()['event']['status'] == 'cancelled'


def test_a_hidden_event_cannot_take_sign_ups():
    _, row = item('event'); _, guest, _ = member(); mod = moderator(); report(member()[1], 'event', row['id'])
    client.post(M, headers=mod, json={'target_type': 'event', 'target_id': row['id'], 'action': 'hide'})
    assert client.post(f"{path('event', row)}/registration", headers=guest).status_code == 404


def test_a_paused_account_cannot_create_events_or_challenges():
    uid, owner, _ = member(); mod = moderator(); row = event(owner); report(member()[1], 'event', row['id'])
    assert client.post(M, headers=mod, json={'target_type': 'event', 'target_id': row['id'], 'action': 'pause_posting'}).status_code == 200
    start = date.today()
    r = client.post(E, headers=owner, json={'title': 'Another run', 'location': 'Cubbon Park gate', 'starts_at': row['starts_at'], 'minutes': 60})
    assert r.status_code == 403
    r = client.post(C, headers=owner, json={'title': 'Another week', 'metric': 'workouts', 'target': 2, 'starts_on': str(start), 'ends_on': str(start + timedelta(days=6))})
    assert r.status_code == 403


def test_only_known_targets_can_be_reported():
    assert report(member()[1], 'event', '00000000-0000-0000-0000-000000000000').status_code == 404
    assert report(member()[1], 'nonsense', 'x' * 36).status_code == 422
