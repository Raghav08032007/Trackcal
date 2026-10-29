"""Phase 8: communities behind the `communities` flag (with `social_feed`). Membership, privacy, community-only posts,
roles, bans, community moderation scoped to its own community, limits and export."""
import uuid

import pytest

from tests.test_adventure import client
from tests.test_social import S, member, feed, ids

C = '/api/v1/communities'


@pytest.fixture(autouse=True)
def flags(monkeypatch):
    monkeypatch.setenv('FEATURE_SOCIAL_FEED', 'true'); monkeypatch.setenv('FEATURE_COMMUNITIES', 'true')


def community(h, visibility='public', slug=None, **extra):
    slug = slug or 'qa-' + uuid.uuid4().hex[:10]
    r = client.post(C, headers=h, json={'name': 'QA Runners ' + slug[-4:], 'slug': slug, 'description': 'Morning runs', 'category': 'running', 'visibility': visibility, **extra})
    assert r.status_code == 201, r.text
    return slug


def cpost(h, slug, body='Community hello'):
    r = client.post(f'{C}/{slug}/posts', headers=h, json={'body': body}); assert r.status_code == 201, r.text
    return r.json()['post']


def test_needs_both_flags(monkeypatch):
    _, h, _ = member()
    monkeypatch.setenv('FEATURE_COMMUNITIES', 'false')
    assert client.get(C, headers=h).status_code == 404


def test_creating_validates_the_address_and_limits_each_person_to_five():
    _, h, _ = member()
    for bad in ('ab', 'Has Space', '-start', 'end-', 'two--dash', 'admin'):
        assert client.post(C, headers=h, json={'name': 'Bad one', 'slug': bad}).status_code == 422, bad
    slugs = [community(h) for _ in range(5)]
    assert client.post(C, headers=h, json={'name': 'Sixth one', 'slug': 'qa-' + uuid.uuid4().hex[:10]}).status_code == 409
    _, other, _ = member()
    assert client.post(C, headers=other, json={'name': 'Copy', 'slug': slugs[0]}).status_code == 409
    view = client.get(f'{C}/{slugs[0]}', headers=h).json()['community']
    assert view['membership'] == {'role': 'owner', 'status': 'active'} and view['members'] == 1 and 'pro-eating-disorder' in view['rules']


def test_public_communities_can_be_read_and_joined_and_found_by_search():
    _, owner, _ = member(); _, reader, _ = member()
    slug = community(owner)
    p = cpost(owner, slug, 'Run at 6')
    assert [x['id'] for x in client.get(f'{C}/{slug}/posts', headers=reader).json()['posts']] == [p['id']]  # read without joining
    assert client.post(f'{C}/{slug}/posts', headers=reader, json={'body': 'hi'}).status_code == 403  # posting needs membership
    assert client.post(f'{C}/{slug}/membership', headers=reader).json()['membership'] == {'role': 'member', 'status': 'active'}
    cpost(reader, slug, 'Count me in')
    assert slug in [c['slug'] for c in client.get(C, headers=reader, params={'q': 'Morning'}).json()['communities']]
    assert slug in [c['slug'] for c in client.get(C, headers=reader, params={'mine': 'true'}).json()['communities']]


def test_community_posts_never_appear_in_the_main_feed_or_profiles():
    _, owner, handle = member(); _, follower, _ = member()
    client.post(f'{S}/follow/{handle}', headers=follower)
    slug = community(owner)
    p = cpost(owner, slug)
    assert p['id'] not in ids(feed(follower)) and p['id'] not in ids(feed(follower, 'discover'))
    assert p['id'] not in ids(client.get(f'{S}/profiles/{handle}', headers=follower).json())


def test_private_communities_need_approval_and_hide_posts_from_outsiders():
    _, owner, _ = member(); _, asker, asker_handle = member()
    slug = community(owner, 'private')
    p = cpost(owner, slug, 'Members only')
    assert client.get(f'{C}/{slug}', headers=asker).json()['locked'] is True
    assert client.get(f'{C}/{slug}/posts', headers=asker).status_code == 403
    assert client.post(f'{S}/posts/{p["id"]}/reactions', headers=asker, json={'kind': 'like'}).status_code == 404  # feed endpoints honour it too
    assert slug not in [c['slug'] for c in client.get(C, headers=asker).json()['communities']]
    assert client.post(f'{C}/{slug}/membership', headers=asker).json()['membership']['status'] == 'pending'
    assert [m['handle'] for m in client.get(f'{C}/{slug}/members', headers=owner, params={'status': 'pending'}).json()['members']] == [asker_handle]
    assert client.get(f'{C}/{slug}/members', headers=asker, params={'status': 'pending'}).status_code == 403
    assert client.post(f'{C}/{slug}/members/{asker_handle}', headers=owner, json={'action': 'approve'}).status_code == 200
    assert [x['id'] for x in client.get(f'{C}/{slug}/posts', headers=asker).json()['posts']] == [p['id']]
    assert client.post(f'{S}/posts/{p["id"]}/comments', headers=asker, json={'body': 'Hi all'}).status_code == 201


def test_bans_stick_and_roles_belong_to_the_owner():
    _, owner, owner_handle = member(); _, mod, mod_handle = member(); _, troll, troll_handle = member()
    slug = community(owner)
    for h in (mod, troll): client.post(f'{C}/{slug}/membership', headers=h)
    assert client.post(f'{C}/{slug}/members/{mod_handle}', headers=troll, json={'action': 'make_moderator'}).status_code == 403
    assert client.post(f'{C}/{slug}/members/{mod_handle}', headers=owner, json={'action': 'make_moderator'}).status_code == 200
    assert client.post(f'{C}/{slug}/members/{troll_handle}', headers=mod, json={'action': 'make_moderator'}).status_code == 403  # mods can't promote
    assert client.post(f'{C}/{slug}/members/{troll_handle}', headers=mod, json={'action': 'ban'}).status_code == 200
    assert client.get(f'{C}/{slug}', headers=troll).status_code == 404
    client.request('DELETE', f'{C}/{slug}/membership', headers=troll)
    assert client.post(f'{C}/{slug}/membership', headers=troll).status_code == 404  # leaving does not lift a ban
    assert client.post(f'{C}/{slug}/members/{owner_handle}', headers=mod, json={'action': 'remove'}).status_code == 409
    assert client.request('DELETE', f'{C}/{slug}/membership', headers=owner).status_code == 409
    assert client.post(f'{C}/{slug}/members/{mod_handle}', headers=owner, json={'action': 'make_owner'}).status_code == 200
    roles = {m['handle']: m['role'] for m in client.get(f'{C}/{slug}/members', headers=mod).json()['members']}
    assert roles[mod_handle] == 'owner' and roles[owner_handle] == 'moderator'


def test_community_moderators_act_only_inside_their_community():
    _, owner, _ = member(); _, other_owner, _ = member()
    slug, elsewhere = community(owner), community(other_owner)
    mine, theirs = cpost(owner, slug, 'Mine'), cpost(other_owner, elsewhere, 'Theirs')
    reporters = [member()[1] for _ in range(2)]
    for h in reporters: client.post(f'{S}/reports', headers=h, json={'target_type': 'post', 'target_id': mine['id'], 'reason': 'spam'})
    queue = client.get(f'{C}/{slug}/moderation', headers=owner).json()['queue']
    assert [q['target_id'] for q in queue] == [mine['id']] and queue[0]['reasons'] == ['spam', 'spam']
    assert client.post(f'{C}/{slug}/moderation', headers=owner, json={'target_type': 'post', 'target_id': theirs['id'], 'action': 'hide'}).status_code == 404
    assert client.post(f'{C}/{slug}/moderation', headers=owner, json={'target_type': 'post', 'target_id': mine['id'], 'action': 'hide'}).json()['status'] == 'actioned'
    assert client.get(f'{C}/{slug}/posts', headers=reporters[0]).json()['posts'] == []
    assert client.get(f'{C}/{elsewhere}/moderation', headers=owner).status_code == 403


def test_archived_communities_stop_taking_posts_and_only_the_owner_archives():
    _, owner, _ = member(); _, mod, mod_handle = member()
    slug = community(owner); client.post(f'{C}/{slug}/membership', headers=mod)
    client.post(f'{C}/{slug}/members/{mod_handle}', headers=owner, json={'action': 'make_moderator'})
    body = {'name': 'QA Runners', 'description': 'x', 'category': 'running', 'visibility': 'public', 'rules': 'Be kind to everyone.', 'archived': True}
    assert client.put(f'{C}/{slug}', headers=mod, json=body).status_code == 403
    assert client.put(f'{C}/{slug}', headers=owner, json=body).json()['community']['archived'] is True
    assert client.post(f'{C}/{slug}/posts', headers=owner, json={'body': 'still here?'}).status_code == 409


def test_the_export_includes_communities_and_memberships():
    _, h, _ = member(); slug = community(h)
    records = client.get('/api/v1/users/export', headers=h).json()['account_records']
    assert records['communities_you_own'][0]['slug'] == slug and records['community_memberships'][0]['role'] == 'owner'


def test_the_browser_routes():
    from tests.test_web_gateway import browser, post as gpost, signed_up
    person = browser(); signed_up(person)
    person.put('/api/social/me', json={'handle': 'qa' + uuid.uuid4().hex[:8], 'display_name': 'QA'}, headers={'Origin': 'http://localhost'})
    slug = 'qa-' + uuid.uuid4().hex[:10]
    assert gpost(person, '/api/communities', {'name': 'Browser Club', 'slug': slug}).status_code == 201
    assert person.get('/api/communities?q=Browser').status_code == 200
    assert gpost(person, f'/api/communities/{slug}/posts', {'body': 'From the browser'}).status_code == 201
    assert person.post(f'/api/communities/{slug}/membership', headers={'Origin': 'http://localhost'}).status_code == 200  # empty body
    assert person.get('/api/communities/BAD SLUG').status_code == 404
