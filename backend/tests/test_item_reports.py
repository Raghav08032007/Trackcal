"""Reporting events and challenges: the shared queue, hiding at three reports, moderator decisions, paused accounts."""
from datetime import date, timedelta

import pytest

import database, models
from tests.test_adventure import client
from tests.test_challenges import challenge
from tests.test_events import event
from tests.test_social import member
from services import notifications as push

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


def pushes(user_id):
    with database.SessionLocal() as db:
        return [(n.type, n.status) for n in db.query(models.ScheduledNotification).filter_by(user_id=user_id, type='event_update').all()]


def subscriber(monkeypatch, types=None):
    monkeypatch.setenv('FEATURE_WEB_PUSH', 'true')
    uid, h, _ = member()
    with database.SessionLocal() as db:
        db.add(models.NotificationSettings(user_id=uid, enabled=True, types=types if types is not None else dict(push.DEFAULT_TYPES), max_per_day=3)); db.commit()
    return uid, h


def test_cancelling_alerts_people_signed_up_once_with_no_details(monkeypatch):
    owner, row = item('event'); uid, guest = subscriber(monkeypatch)
    client.post(f"{path('event', row)}/registration", headers=guest)
    client.request('DELETE', path('event', row), headers=owner); client.request('DELETE', path('event', row), headers=owner)
    assert pushes(uid) == [('event_update', 'pending')]
    message = push.TYPES['event_update']
    assert row['title'] not in message['title'] + message['body'] and row['location'] not in message['body']


def test_settings_saved_before_this_type_existed_still_get_the_alert(monkeypatch):
    owner, row = item('event'); uid, guest = subscriber(monkeypatch, {'milestone': {'enabled': True, 'time': None}})
    client.post(f"{path('event', row)}/registration", headers=guest)
    client.request('DELETE', path('event', row), headers=owner)
    assert len(pushes(uid)) == 1


def test_turning_the_alert_off_is_respected(monkeypatch):
    owner, row = item('event'); uid, guest = subscriber(monkeypatch, {**push.DEFAULT_TYPES, 'event_update': {'enabled': False, 'time': None}})
    client.post(f"{path('event', row)}/registration", headers=guest)
    client.request('DELETE', path('event', row), headers=owner)
    assert pushes(uid) == []


def test_hiding_an_event_alerts_people_signed_up(monkeypatch):
    _, row = item('event'); uid, guest = subscriber(monkeypatch); mod = moderator()
    client.post(f"{path('event', row)}/registration", headers=guest); report(member()[1], 'event', row['id'])
    client.post(M, headers=mod, json={'target_type': 'event', 'target_id': row['id'], 'action': 'hide'})
    assert len(pushes(uid)) == 1


def test_no_alert_while_push_is_off():
    owner, row = item('event'); uid, guest = member()[0:2]
    client.post(f"{path('event', row)}/registration", headers=guest)
    client.request('DELETE', path('event', row), headers=owner)
    assert pushes(uid) == []


def test_older_saved_settings_still_list_every_type(monkeypatch):
    uid, h = subscriber(monkeypatch, {'milestone': {'enabled': True, 'time': None}})
    types = client.get('/api/v1/push/settings', headers=h).json()['types']
    assert types['event_update']['enabled'] is True and types['milestone']['enabled'] is True


def test_flagged_challenge_entries_can_be_cleared_or_removed_and_stay_decided():
    """KI-49: moderators see flagged entries, clear or remove them, and a cleared entry is not flagged again. XP is never touched."""
    _, owner, _ = member(); row = challenge(owner)
    joiner, jh, _ = member(); assert client.post(f"{C}/{row['id']}/participation", headers=jh).status_code in (200, 201)
    with database.SessionLocal() as db:
        entry = db.query(models.ChallengeParticipant).filter_by(challenge_id=row['id'], user_id=joiner).one(); entry.flagged = True; db.commit()
    mod = moderator()
    assert client.get(M, headers=owner).status_code == 403   # members can't see the queue
    queue = client.get(M, headers=mod).json()['flagged_entries']
    assert any(e['challenge_id'] == row['id'] and e['user_id'] == joiner for e in queue)
    assert client.post(M + '/entries', headers=jh, json={'challenge_id': row['id'], 'user_id': joiner, 'action': 'clear'}).status_code == 403
    assert client.post(M + '/entries', headers=mod, json={'challenge_id': row['id'], 'user_id': joiner, 'action': 'clear'}).json() == {'status': 'cleared'}
    client.get(f"{C}/{row['id']}", headers=jh)   # progress settles again on view: a reviewed entry stays cleared
    with database.SessionLocal() as db:
        entry = db.query(models.ChallengeParticipant).filter_by(challenge_id=row['id'], user_id=joiner).one()
        assert entry.flagged is False and entry.flag_reviewed_at is not None and entry.left_at is None
        entry.flagged = True; entry.flag_reviewed_at = None; db.commit()
    assert client.post(M + '/entries', headers=mod, json={'challenge_id': row['id'], 'user_id': joiner, 'action': 'remove'}).json() == {'status': 'removed'}
    with database.SessionLocal() as db:
        assert db.query(models.ChallengeParticipant).filter_by(challenge_id=row['id'], user_id=joiner).one().left_at is not None
    assert not any(e['user_id'] == joiner for e in client.get(M, headers=mod).json()['flagged_entries'])
