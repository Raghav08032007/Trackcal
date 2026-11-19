"""KI-40: a person banned from a community can appeal to TrackCal. Only site moderators decide (never the community's
own moderators); reinstating lifts the ban; one open appeal at a time and a wait after a decision. Site moderators also
see how each community is moderated."""
from datetime import timedelta

import pytest

import models
import database
from tests.test_adventure import client
from tests.test_communities import C, community, cpost
from tests.test_item_reports import moderator
from tests.test_social import S, member


@pytest.fixture(autouse=True)
def flags(monkeypatch):
    monkeypatch.setenv('FEATURE_SOCIAL_FEED', 'true'); monkeypatch.setenv('FEATURE_COMMUNITIES', 'true')


def banned():
    _, owner, _ = member(); _, person, handle = member()
    slug = community(owner)
    client.post(f'{C}/{slug}/membership', headers=person)
    assert client.post(f'{C}/{slug}/members/{handle}', headers=owner, json={'action': 'ban'}).status_code == 200
    return slug, owner, person, handle


def appeals():
    return client.get(f'{S}/moderation', headers=moderator()).json()['appeals']


def test_a_banned_person_sees_the_ban_and_can_appeal_once():
    slug, _, person, handle = banned()
    bans = client.get(f'{C}/bans', headers=person).json()['bans']
    assert [b['slug'] for b in bans] == [slug] and bans[0]['can_appeal'] and bans[0]['appeal'] is None
    assert client.post(f'{C}/{slug}/appeal', headers=person, json={'note': 'short'}).status_code == 422
    r = client.post(f'{C}/{slug}/appeal', headers=person, json={'note': 'I was joking with a friend, sorry. I will follow the rules.'})
    assert r.status_code == 201 and 'TrackCal' in r.json()['status']
    assert client.post(f'{C}/{slug}/appeal', headers=person, json={'note': 'Please look again at my ban.'}).status_code == 409
    assert client.get(f'{C}/bans', headers=person).json()['bans'][0]['appeal'] == 'open'
    assert any(a['slug'] == slug and a['handle'] == handle for a in appeals())


def test_only_banned_people_can_appeal():
    _, owner, _ = member(); _, other, _ = member()
    slug = community(owner)
    assert client.post(f'{C}/{slug}/appeal', headers=other, json={'note': 'I am not banned at all.'}).status_code == 404
    assert client.get(f'{C}/bans', headers=other).json()['bans'] == []


def test_reinstating_lifts_the_ban_and_the_community_moderators_cannot_decide():
    slug, owner, person, _ = banned()
    client.post(f'{C}/{slug}/appeal', headers=person, json={'note': 'I was joking with a friend, sorry.'})
    appeal_id = next(a['id'] for a in appeals() if a['slug'] == slug)
    assert client.post(f'{C}/appeals', headers=owner, json={'appeal_id': appeal_id, 'action': 'reinstate'}).status_code == 403
    assert client.post(f'{C}/appeals', headers=moderator(), json={'appeal_id': appeal_id, 'action': 'reinstate'}).json()['status'] == 'reinstated'
    assert client.get(f'{C}/bans', headers=person).json()['bans'] == []
    assert client.post(f'{C}/{slug}/membership', headers=person).status_code in (200, 201)
    assert client.post(f'{C}/appeals', headers=moderator(), json={'appeal_id': appeal_id, 'action': 'uphold'}).status_code == 404   # decided once


def test_an_upheld_ban_can_be_appealed_again_after_the_wait():
    slug, _, person, _ = banned()
    client.post(f'{C}/{slug}/appeal', headers=person, json={'note': 'Please review my ban, thank you.'})
    appeal_id = next(a['id'] for a in appeals() if a['slug'] == slug)
    assert client.post(f'{C}/appeals', headers=moderator(), json={'appeal_id': appeal_id, 'action': 'uphold'}).json()['status'] == 'upheld'
    ban = client.get(f'{C}/bans', headers=person).json()['bans'][0]
    assert ban['appeal'] == 'upheld' and not ban['can_appeal'] and ban['next_appeal_at']
    assert client.post(f'{C}/{slug}/appeal', headers=person, json={'note': 'Please review my ban again.'}).status_code == 409
    with database.SessionLocal() as db:
        row = db.get(models.ContentReport, appeal_id); row.resolved_at -= timedelta(days=31); db.commit()
    assert client.post(f'{C}/{slug}/appeal', headers=person, json={'note': 'Please review my ban again.'}).status_code == 201


def test_site_moderators_see_how_communities_are_moderated():
    slug, owner, person, _ = banned()
    _, reader, _ = member(); client.post(f'{C}/{slug}/membership', headers=reader)
    post = cpost(owner, slug)
    client.post(f'{S}/reports', headers=reader, json={'target_type': 'post', 'target_id': post['id'], 'reason': 'spam'})
    client.post(f'{C}/{slug}/appeal', headers=person, json={'note': 'Please review my ban, thank you.'})
    body = client.get(f'{S}/moderation', headers=moderator()).json()
    row = next(c for c in body['communities'] if c['slug'] == slug)
    assert row['banned'] == 1 and row['open_reports'] >= 1 and row['open_appeals'] == 1 and row['moderators'] == 1 and row['members'] >= 2
    assert all(item['target_type'] != 'ban' for item in body['queue'])   # appeals are listed separately


def test_appeal_names_are_reserved():
    _, h, _ = member()
    for slug in ('bans', 'appeals'):
        assert client.post(C, headers=h, json={'name': 'Reserved one', 'slug': slug}).status_code == 422


def test_the_browser_routes():
    from tests.test_web_gateway import browser, post as gpost, signed_up
    person = browser(); signed_up(person)
    assert person.get('/api/communities/bans').get_json() == {'bans': []}
    _, owner, _ = member(); slug = community(owner)
    assert gpost(person, f'/api/communities/{slug}/appeal', {'note': 'I am not banned at all.'}).status_code == 404   # reaches the API
    assert gpost(person, '/api/communities/appeals', {'appeal_id': 'x' * 36, 'action': 'uphold'}).status_code == 403   # moderators only
