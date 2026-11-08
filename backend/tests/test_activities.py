"""GPS activities end to end: record, personal records, sharing rules, privacy zones, edits, and what a bad client can't do."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from services import activity_stats as stats
from tests.client import client
from tests.test_activities_helpers import fixes_for
from tests.test_social import member

A = '/api/v1/activities'


@pytest.fixture(autouse=True)
def flag_on(monkeypatch):
    monkeypatch.setenv('FEATURE_SOCIAL_FEED', 'true')


def started(minutes_ago=60):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()


def record(h, seconds=1500, speed=10 / 3, sport='run', **extra):
    body = {'sport': sport, 'started_at': started(), 'fixes': fixes_for([(seconds, speed)]), **extra}
    return client.post(A, headers=h, json=body)


def test_a_run_is_measured_on_the_server_and_its_records_are_announced():
    _, h, _ = member()
    first = record(h)
    assert first.status_code == 201, first.text
    run = first.json()['activity']
    assert run['distance_m'] == pytest.approx(5000, rel=0.035)
    assert run['moving_s'] == pytest.approx(1500, rel=0.03)
    assert run['name'] in {'Morning run', 'Afternoon run', 'Evening run', 'Night run'}
    assert [s['km'] for s in run['splits']][:4] == [1, 2, 3, 4]
    assert {e['label'] for e in run['best_efforts']} >= {'1 km', '5 km'} or run['distance_m'] < 5000
    labels = {r['label'] for r in first.json()['new_records']}
    assert '1 km' in labels and run['visibility'] == 'private' and run['mine'] is True
    # A faster, shorter run beats the 1 km best only.
    second = record(h, seconds=720, speed=1000 / 240).json()
    assert {r['label'] for r in second['new_records'] if r['kind'] == 'best_effort'} >= {'1 km'}
    assert not any(r['kind'] == 'longest' for r in second['new_records'])
    best = client.get(f'{A}/records?sport=run', headers=h).json()
    assert next(e for e in best['best_efforts'] if e['label'] == '1 km')['activity_id'] == second['activity']['id']
    assert best['longest']['activity_id'] == run['id']
    listed = client.get(A, headers=h).json()
    assert [a['id'] for a in listed['activities']] == [second['activity']['id'], run['id']] or len(listed['activities']) == 2
    assert listed['last_7_days']['count'] == 2 and 'route' not in listed['activities'][0] and len(listed['activities'][0]['preview']) <= 60
    assert client.get(A + '?sport=ride', headers=h).json()['activities'] == []


def test_saving_is_idempotent_and_ids_cannot_be_taken_over():
    _, h, _ = member()
    _, other, _ = member()
    identifier = str(uuid.uuid4())
    one = record(h, id=identifier).json()['activity']
    again = record(h, id=identifier)
    assert again.status_code == 201 and again.json()['activity']['id'] == one['id'] and again.json()['new_records'] == []
    assert len(client.get(A, headers=h).json()['activities']) == 1
    assert record(other, id=identifier).status_code == 409


def test_who_can_see_a_route_and_what_they_see():
    _, owner, owner_handle = member()
    _, follower, _ = member()
    _, stranger, _ = member()
    run = record(owner, seconds=900).json()['activity']
    url = f"{A}/{run['id']}"
    assert client.get(url, headers=stranger).status_code == 404
    client.post(f'/api/v1/social/follow/{owner_handle}', headers=follower)
    assert client.get(url, headers=follower).status_code == 404  # private
    assert client.patch(url, headers=owner, json={'visibility': 'followers'}).status_code == 200
    seen = client.get(url, headers=follower).json()['activity']
    assert client.get(url, headers=stranger).status_code == 404
    assert seen['mine'] is False and 'fixes_used' not in seen
    full = client.get(url, headers=owner).json()['activity']['route']
    start, end = full[0], full[-1]
    assert seen['route'] and all(stats.metres(p, start) > 200 and stats.metres(p, end) > 200 for p in seen['route'])
    assert all(p[2] is None and p[4] is None for p in seen['route'])  # no timing that would place the start
    client.patch(url, headers=owner, json={'visibility': 'everyone'})
    assert client.get(url, headers=stranger).status_code == 200


def test_privacy_zones_are_cut_from_shared_routes():
    _, owner, _ = member()
    _, viewer, _ = member()
    run = record(owner, seconds=900, visibility='everyone').json()['activity']
    full = client.get(f"{A}/{run['id']}", headers=owner).json()['activity']['route']
    middle = full[len(full) // 2]
    zone = client.post(f'{A}/privacy-zones', headers=owner, json={'label': 'Work', 'lat': middle[0], 'lon': middle[1], 'radius_m': 250})
    assert zone.status_code == 201, zone.text
    seen = client.get(f"{A}/{run['id']}", headers=viewer).json()['activity']['route']
    assert seen and all(stats.metres(p, middle) > 250 for p in seen)
    assert len(client.get(f"{A}/{run['id']}", headers=owner).json()['activity']['route']) == len(full)  # the owner sees everything
    for k in range(4):
        assert client.post(f'{A}/privacy-zones', headers=owner, json={'label': f'Z{k}', 'lat': 1, 'lon': 1}).status_code == 201
    assert client.post(f'{A}/privacy-zones', headers=owner, json={'label': 'Too many', 'lat': 1, 'lon': 1}).status_code == 422
    assert client.post(f'{A}/privacy-zones', headers=owner, json={'label': 'Tiny', 'lat': 1, 'lon': 1, 'radius_m': 20}).status_code == 422
    zone_id = zone.json()['zones'][0]['id']
    assert client.delete(f'{A}/privacy-zones/{zone_id}', headers=viewer).status_code == 404
    assert client.delete(f'{A}/privacy-zones/{zone_id}', headers=owner).status_code == 200


def test_edit_and_delete_belong_to_the_owner():
    _, owner, _ = member()
    _, other, _ = member()
    run = record(owner).json()['activity']
    url = f"{A}/{run['id']}"
    assert client.patch(url, headers=other, json={'name': 'Mine now'}).status_code == 404
    edited = client.patch(url, headers=owner, json={'name': ' Park loop ', 'notes': 'Felt strong'}).json()['activity']
    assert edited['name'] == 'Park loop' and edited['notes'] == 'Felt strong'
    assert client.patch(url, headers=owner, json={'visibility': 'public'}).status_code == 422
    assert client.delete(url, headers=other).status_code == 404
    assert client.delete(url, headers=owner).status_code == 204
    assert client.get(url, headers=owner).status_code == 404
    assert client.get(f'{A}/records?sport=run', headers=owner).json()['best_efforts'] == []


def test_bad_input_is_refused():
    _, h, _ = member()
    _, other, _ = member()
    assert record(h, seconds=10).status_code == 422                                   # too short to be an activity
    assert record(h, sport='swim').status_code == 422
    old = {'sport': 'run', 'started_at': (datetime.now(timezone.utc) - timedelta(days=40)).isoformat(), 'fixes': fixes_for([(600, 3)])}
    assert client.post(A, headers=h, json=old).status_code == 422
    too_many = {'sport': 'run', 'started_at': started(), 'fixes': [[0, 0, k * 1000, 5] for k in range(stats.MAX_FIXES + 1)]}
    assert client.post(A, headers=h, json=too_many).status_code == 422
    session = client.post('/api/v1/wellness/sessions', headers=other, json={'id': str(uuid.uuid4()), 'name': 'Theirs', 'exercises': ['run']})
    assert session.status_code in (200, 201), session.text
    assert record(h, session_id=session.json()['session']['id']).status_code == 404   # someone else's workout
    assert client.get(A).status_code == 401


def test_the_export_includes_activities_and_privacy_zones():
    _, h, _ = member()
    record(h)
    client.post(f'{A}/privacy-zones', headers=h, json={'label': 'Home', 'lat': 12.9, 'lon': 77.5})
    records = client.get('/api/v1/users/export', headers=h).json()['account_records']
    assert len(records['activities']) == 1 and records['privacy_zones'][0]['label'] == 'Home'


def feed_ids(h):
    return {p['id']: p for p in client.get('/api/v1/social/feed?tab=following', headers=h).json()['posts']}


def test_a_shared_activity_is_a_feed_card_with_kudos_and_comments():
    _, owner, owner_handle = member()
    _, friend, _ = member()
    client.post(f'/api/v1/social/follow/{owner_handle}', headers=friend)
    private = record(owner).json()['activity']
    assert private['post'] is None and not any(p['milestone'] and p['milestone']['type'] == 'activity' for p in feed_ids(friend).values())
    shared = client.patch(f"{A}/{private['id']}", headers=owner, json={'visibility': 'followers', 'notes': 'Sunrise loop'}).json()['activity']
    post = shared['post']
    assert post and post['milestone']['type'] == 'activity' and post['body'] == 'Sunrise loop'
    card = feed_ids(friend)[post['id']]['milestone']['activity']
    assert card['id'] == private['id'] and card['distance_m'] == pytest.approx(private['distance_m']) and '1 km' in card['records']
    assert len(card['preview']) >= 2
    kudos = client.post(f"/api/v1/social/posts/{post['id']}/reactions", headers=friend, json={'kind': 'like'})
    assert kudos.status_code == 200 and kudos.json()['post']['reactions']['like'] == 1
    assert client.post(f"/api/v1/social/posts/{post['id']}/comments", headers=friend, json={'body': 'Great pace!'}).status_code in (200, 201)
    seen = client.get(f"{A}/{private['id']}", headers=friend).json()['activity']['post']
    assert seen['reactions']['like'] == 1 and seen['comment_count'] == 1 and seen['my_reaction'] == 'like'
    # Private again: gone from the feed. Shared again: the same card is back with its kudos.
    client.patch(f"{A}/{private['id']}", headers=owner, json={'visibility': 'private'})
    assert post['id'] not in feed_ids(friend)
    client.patch(f"{A}/{private['id']}", headers=owner, json={'visibility': 'everyone'})
    assert feed_ids(friend)[post['id']]['reactions']['like'] == 1
    client.delete(f"{A}/{private['id']}", headers=owner)
    assert post['id'] not in feed_ids(friend)


def test_sharing_without_a_handle_still_works_and_posts_nothing():
    from tests.test_adventure import account
    _, h = account()
    run = record(h, visibility='everyone')
    assert run.status_code == 201 and run.json()['activity']['post'] is None


def test_people_who_did_it_together_are_shown_when_their_activity_is_visible():
    _, a, a_handle = member()
    _, b, b_handle = member()
    _, c, _ = member()
    run_a = record(a, visibility='everyone').json()['activity']
    run_b = client.post(A, headers=b, json={'sport': 'run', 'started_at': started(58), 'fixes': fixes_for([(1500, 10 / 3)], seed=2), 'visibility': 'everyone'}).json()['activity']
    with_a = client.get(f"{A}/{run_a['id']}", headers=a).json()['activity']['together']
    assert [t['handle'] for t in with_a] == [b_handle] and with_a[0]['activity_id'] == run_b['id']
    client.patch(f"{A}/{run_b['id']}", headers=b, json={'visibility': 'private'})
    assert client.get(f"{A}/{run_a['id']}", headers=a).json()['activity']['together'] == []
    # Someone elsewhere at the same time is not "with" you.
    far = [[f[0] + 0.05, f[1], f[2], f[3]] for f in fixes_for([(1500, 10 / 3)], seed=3)]
    client.post(A, headers=c, json={'sport': 'run', 'started_at': started(60), 'fixes': far, 'visibility': 'everyone'})
    assert client.get(f"{A}/{run_a['id']}", headers=a).json()['activity']['together'] == []
