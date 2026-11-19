"""Phase 9: verified events behind the `verified_events` flag (with `social_feed`). Creation rules, waitlist,
visibility, rotating QR check-in, organizer check-in, XP paid once, privacy of attendee lists, export."""
import uuid
from datetime import timedelta, timezone

import pytest

from routers import events as ev
from timeutil import utcnow
from tests.test_adventure import client, init
from tests.test_social import member

E = '/api/v1/events'


@pytest.fixture(autouse=True)
def flags(monkeypatch):
    for f in ('SOCIAL_FEED', 'COMMUNITIES', 'VERIFIED_EVENTS'): monkeypatch.setenv(f'FEATURE_{f}', 'true')


def iso(minutes):
    return (utcnow() + timedelta(minutes=minutes)).replace(tzinfo=timezone.utc).isoformat()


def event(h, starts=20, **extra):
    r = client.post(E, headers=h, json={'title': 'Sunrise run', 'location': 'Cubbon Park gate', 'starts_at': iso(starts), 'minutes': 60, 'category': 'running', **extra})
    assert r.status_code == 201, r.text
    return r.json()['event']


def code(h, eid):
    r = client.get(f'{E}/{eid}/check-in-code', headers=h); assert r.status_code == 200, r.text
    return r.json()


def test_needs_the_flag(monkeypatch):
    _, h, _ = member(); monkeypatch.setenv('FEATURE_VERIFIED_EVENTS', 'false')
    assert client.get(E, headers=h).status_code == 404


def test_creation_rules():
    _, h, _ = member()
    assert client.post(E, headers=h, json={'title': 'Too soon', 'location': 'Park', 'starts_at': iso(2), 'minutes': 60}).status_code == 422
    assert client.post(E, headers=h, json={'title': 'Too far', 'location': 'Park', 'starts_at': iso(60 * 24 * 200), 'minutes': 60}).status_code == 422
    assert client.post(E, headers=h, json={'title': 'Bad zone', 'location': 'Park', 'starts_at': iso(60), 'minutes': 60, 'timezone': 'Mars/Base'}).status_code == 422
    for i in range(10): event(h, 60 + i)
    assert client.post(E, headers=h, json={'title': 'Eleventh', 'location': 'Park', 'starts_at': iso(200), 'minutes': 60}).status_code == 409


def test_capacity_waitlist_and_promotion():
    _, org, _ = member(); people = [member()[1] for _ in range(3)]
    e = event(org, capacity=2)
    statuses = [client.post(f'{E}/{e["id"]}/registration', headers=h).json()['event']['mine']['status'] for h in people]
    assert statuses == ['going', 'going', 'waitlist']
    assert client.post(f'{E}/{e["id"]}/registration', headers=org).status_code == 409  # organizer doesn't take a seat
    client.request('DELETE', f'{E}/{e["id"]}/registration', headers=people[0])
    after = client.get(f'{E}/{e["id"]}', headers=people[2]).json()['event']
    assert after['mine']['status'] == 'going' and after['going'] == 2 and after['waitlist'] == 0


def test_rotating_qr_check_in_verifies_attendance_and_pays_xp_once(monkeypatch):
    _, org, _ = member(); _, guest, _ = member(); init(guest)
    e = event(org)
    client.post(f'{E}/{e["id"]}/registration', headers=guest)
    first = code(org, e['id'])
    assert first['path'] == f'/events/{e["id"]}/check-in' and 0 < first['refresh_in'] <= 31
    assert client.post(f'{E}/{e["id"]}/check-in', headers=guest, json={'token': 'x' * 20}).status_code == 403
    ok = client.post(f'{E}/{e["id"]}/check-in', headers=guest, json={'token': first['token']})
    assert ok.status_code == 200 and ok.json()['awarded_xp'] == 50 and ok.json()['event']['mine']['checked_in'] is True
    again = client.post(f'{E}/{e["id"]}/check-in', headers=guest, json={'token': first['token']})
    assert again.json()['awarded_xp'] == 0
    summary = client.get('/api/v1/adventure/summary', headers=guest).json()
    assert summary['xp'] == 50 and any(a['code'] == 'event_attendee' and a['status'] == 'unlocked' for a in summary['achievements'])
    assert client.request('DELETE', f'{E}/{e["id"]}/registration', headers=guest).status_code == 409  # can't un-attend


def test_qr_tokens_expire_after_one_window(monkeypatch):
    _, org, _ = member(); _, guest, _ = member()
    e = event(org); client.post(f'{E}/{e["id"]}/registration', headers=guest)
    token = code(org, e['id'])['token']
    later = utcnow() + timedelta(seconds=ev.WINDOW_SECONDS * 2 + 1)
    monkeypatch.setattr(ev, 'utcnow', lambda: later)
    assert client.post(f'{E}/{e["id"]}/check-in', headers=guest, json={'token': token}).status_code == 403


def test_check_in_only_inside_the_window_and_only_for_registered_people(monkeypatch):
    _, org, _ = member(); _, guest, _ = member(); _, stranger, _ = member()
    e = event(org, starts=120)
    assert client.get(f'{E}/{e["id"]}/check-in-code', headers=org).status_code == 409  # too early
    client.post(f'{E}/{e["id"]}/registration', headers=guest)
    soon = utcnow() + timedelta(minutes=100)
    monkeypatch.setattr(ev, 'utcnow', lambda: soon)
    token = code(org, e['id'])['token']
    assert client.post(f'{E}/{e["id"]}/check-in', headers=stranger, json={'token': token}).status_code == 409
    assert client.get(f'{E}/{e["id"]}/check-in-code', headers=guest).status_code == 403
    assert client.post(f'{E}/{e["id"]}/check-in', headers=org, json={'token': token}).status_code == 409  # organizer can't self-verify


def test_organizer_check_in_by_handle_and_private_attendee_list():
    _, org, org_handle = member(); _, guest, guest_handle = member(); _, other, _ = member()
    e = event(org); client.post(f'{E}/{e["id"]}/registration', headers=guest)
    assert client.post(f'{E}/{e["id"]}/check-in', headers=other, json={'handle': guest_handle}).status_code == 403
    assert client.post(f'{E}/{e["id"]}/check-in', headers=org, json={'handle': org_handle}).status_code == 409
    assert client.post(f'{E}/{e["id"]}/check-in', headers=org, json={'handle': guest_handle}).status_code == 200
    people = client.get(f'{E}/{e["id"]}/attendees', headers=org).json()['attendees']
    assert people == [{'handle': guest_handle, 'display_name': people[0]['display_name'], 'status': 'going', 'checked_in': True, 'method': 'organizer'}]
    assert client.get(f'{E}/{e["id"]}/attendees', headers=guest).status_code == 403


def test_private_community_events_are_for_members_and_only_moderators_add_them():
    from tests.test_communities import community
    _, owner, _ = member(); _, outsider, _ = member()
    slug = community(owner, 'private')
    assert client.post(E, headers=outsider, json={'title': 'Sneaky', 'location': 'Park', 'starts_at': iso(60), 'minutes': 60, 'community': slug}).status_code == 403
    e = event(owner, community=slug)
    assert e['community']['slug'] == slug
    assert client.get(f'{E}/{e["id"]}', headers=outsider).status_code == 404
    assert e['id'] not in [x['id'] for x in client.get(E, headers=outsider).json()['events']]


def test_cancelled_events_stop_sign_ups_and_check_in():
    _, org, _ = member(); _, guest, _ = member()
    e = event(org)
    assert client.request('DELETE', f'{E}/{e["id"]}', headers=guest).status_code == 403
    assert client.request('DELETE', f'{E}/{e["id"]}', headers=org).json()['event']['status'] == 'cancelled'
    assert client.post(f'{E}/{e["id"]}/registration', headers=guest).status_code == 409
    assert client.get(f'{E}/{e["id"]}/check-in-code', headers=org).status_code == 409


def test_export_includes_events_without_the_qr_secret():
    _, org, _ = member(); e = event(org)
    records = client.get('/api/v1/users/export', headers=org).json()['account_records']
    assert records['events_you_organize'][0]['id'] == e['id'] and 'checkin_key' not in records['events_you_organize'][0]


def test_browser_routes():
    from tests.test_web_gateway import browser, post as gpost, signed_up
    person = browser(); signed_up(person)
    person.put('/api/social/me', json={'handle': 'qa' + uuid.uuid4().hex[:8], 'display_name': 'QA'}, headers={'Origin': 'http://localhost'})
    made = gpost(person, '/api/events', {'title': 'Browser walk', 'location': 'Lake', 'starts_at': iso(15), 'minutes': 30})
    assert made.status_code == 201
    eid = made.get_json()['event']['id']
    assert person.get('/api/events?scope=mine').get_json()['events'][0]['id'] == eid
    assert person.get(f'/api/events/{eid}/check-in-code').status_code == 200
    assert person.get('/api/events/not-an-id').status_code == 404


def test_a_check_in_code_with_unusual_characters_is_refused_cleanly():
    _, org, _ = member(); _, guest, _ = member()
    e = event(org); client.post(f'{E}/{e["id"]}/registration', headers=guest)
    r = client.post(f'{E}/{e["id"]}/check-in', headers=guest, json={'token': 'कोड-कोड-कोड-कोड'})
    assert r.status_code == 403 and 'expired' in r.text


def test_a_home_address_is_refused_as_an_event_location():
    """Events are visible to every signed-in member, so a flat or house number is refused in favour of a public place."""
    _, h, _ = member()
    for place in ('Flat 4B, Green Towers', 'House no. 12, MG Road', 'my place', 'मेरा घर, सेक्टर 4'):
        r = client.post(E, headers={**h, 'Accept-Language': 'hi'}, json={'title': 'Evening walk', 'location': place, 'starts_at': iso(120), 'minutes': 60})
        assert r.status_code == 422 and 'सार्वजनिक' in r.json()['detail'], place
    assert client.post(E, headers=h, json={'title': 'Evening walk', 'location': 'Gym, 2nd floor, City Centre', 'starts_at': iso(120), 'minutes': 60}).status_code == 201
