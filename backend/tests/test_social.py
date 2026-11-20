"""Phase 7: social feed behind the `social_feed` flag. Visibility, private accounts, blocks/mutes, server-verified
milestones, reactions with counts, comments, reports with auto-hide, moderation, paging and data export."""
import uuid

import pytest

import database, models
from tests.test_adventure import account, client, init

S = '/api/v1/social'


@pytest.fixture(autouse=True)
def flag_on(monkeypatch):
    monkeypatch.setenv('FEATURE_SOCIAL_FEED', 'true')


def member(private=False, name=None, new=False):
    """A feed member. Established (profile 4 days old) unless new=True: new accounts post more slowly, can't share links
    and don't reach Discover for a day (services/spam.py)."""
    user_id, h = account()
    handle = (name or 'qa' + uuid.uuid4().hex[:10])
    r = client.put(f'{S}/me', headers=h, json={'handle': handle, 'display_name': handle.title(), 'bio': 'QA', 'private': private})
    assert r.status_code == 200, r.text
    if not new:
        import database, models
        from datetime import timedelta
        from timeutil import utcnow
        with database.SessionLocal() as db:
            db.get(models.SocialProfile, user_id).created_at = utcnow() - timedelta(days=4); db.commit()
    return user_id, h, handle


def post(h, body='Hello', **extra):
    r = client.post(f'{S}/posts', headers=h, json={'body': body, **extra}); assert r.status_code == 201, r.text
    return r.json()['post']


def feed(h, tab='following', before=None):
    params = {'tab': tab, **({'before': before} if before else {})}
    return client.get(f'{S}/feed', headers=h, params=params).json()


def ids(view): return [p['id'] for p in view['posts']]


def test_everything_is_hidden_while_the_flag_is_off(monkeypatch):
    monkeypatch.setenv('FEATURE_SOCIAL_FEED', 'false')
    _, h = account()
    assert client.get(f'{S}/me', headers=h).status_code == 404 and client.get(f'{S}/feed', headers=h).status_code == 404


def test_handles_are_validated_unique_and_needed_before_posting():
    _, h = account()
    assert client.post(f'{S}/posts', headers=h, json={'body': 'hi'}).status_code == 409  # no profile yet
    for bad in ('ab', 'admin', 'Has Space', '..dots', 'x' * 31):
        assert client.put(f'{S}/me', headers=h, json={'handle': bad, 'display_name': 'X'}).status_code == 422, bad
    _, _, taken = member()
    assert client.put(f'{S}/me', headers=h, json={'handle': taken.upper(), 'display_name': 'X'}).status_code == 409


def test_public_posts_reach_discover_and_followers_only_posts_reach_followers():
    _, author, handle = member(); _, follower, _ = member(); _, stranger, _ = member()
    public, private_post = post(author, 'Public hello'), post(author, 'Just for followers', visibility='followers')
    assert client.post(f'{S}/follow/{handle}', headers=follower).json()['status'] == 'active'
    assert public['id'] in ids(feed(stranger, 'discover')) and private_post['id'] not in ids(feed(stranger, 'discover'))
    assert {public['id'], private_post['id']} <= set(ids(feed(follower)))
    assert private_post['id'] not in ids(client.get(f'{S}/profiles/{handle}', headers=stranger).json())
    assert client.post(f'{S}/posts/{private_post["id"]}/reactions', headers=stranger, json={'kind': 'like'}).status_code == 404


def test_private_accounts_need_approval_and_going_public_lets_people_in():
    _, owner, handle = member(private=True); _, asker, asker_handle = member()
    secret = post(owner, 'Private account post')
    assert client.post(f'{S}/follow/{handle}', headers=asker).json()['status'] == 'pending'
    view = client.get(f'{S}/profiles/{handle}', headers=asker).json()
    assert view['locked'] is True and view['posts'] == [] and secret['id'] not in ids(feed(asker, 'discover'))
    assert client.get(f'{S}/profiles/{handle}/connections', headers=asker).status_code == 403
    assert [r['handle'] for r in client.get(f'{S}/requests', headers=owner).json()['requests']] == [asker_handle]
    assert client.post(f'{S}/requests/{asker_handle}', headers=owner, json={'action': 'approve'}).status_code == 200
    assert secret['id'] in ids(feed(asker))


def test_blocking_hides_both_people_and_ends_follows_while_muting_only_hides_for_the_muter():
    _, a, a_handle = member(); _, b, b_handle = member(); _, c, c_handle = member()
    client.post(f'{S}/follow/{b_handle}', headers=a); client.post(f'{S}/follow/{a_handle}', headers=b)
    b_post = post(b, 'From b')
    assert client.post(f'{S}/block/{b_handle}', headers=a, json={'kind': 'block'}).status_code == 200
    assert client.get(f'{S}/profiles/{a_handle}', headers=b).status_code == 404
    assert b_post['id'] not in ids(feed(a, 'discover')) and client.post(f'{S}/follow/{a_handle}', headers=b).status_code == 404
    assert client.get(f'{S}/profiles/{b_handle}', headers=c).json()['profile']['counts']['followers'] == 0
    c_post = post(c, 'From c')
    client.post(f'{S}/block/{c_handle}', headers=a, json={'kind': 'mute'})
    assert c_post['id'] not in ids(feed(a, 'discover')) and c_post['id'] in ids(feed(b, 'discover'))
    assert client.get(f'{S}/profiles/{a_handle}', headers=c).status_code == 200  # muting is one-way and invisible


def test_milestones_are_verified_and_snapshotted_by_the_server():
    owner, h, _ = member(); init(h)
    with database.SessionLocal() as db:
        code = db.query(models.AchievementDefinition.code).first()[0]
        db.add(models.UserAchievement(user_id=owner, code=code)); db.commit()
    shareable = client.get(f'{S}/milestones', headers=h).json()['milestones']
    achievement = next(m for m in shareable if m['type'] == 'achievement')
    shared = post(h, '', milestone={'type': 'achievement', 'ref': achievement['ref']})
    assert shared['milestone'] == {'type': 'achievement', 'title': achievement['title']}
    assert client.post(f'{S}/posts', headers=h, json={'body': '', 'milestone': {'type': 'workout', 'ref': str(uuid.uuid4())}}).status_code == 422
    assert client.post(f'{S}/posts', headers=h, json={'body': '', 'milestone': {'type': 'level', 'ref': '99'}}).status_code == 422
    assert client.post(f'{S}/posts', headers=h, json={'body': '   '}).status_code == 422


def test_reactions_have_public_counts_one_per_person_and_can_change():
    _, author, _ = member(); _, x, _ = member(); _, y, _ = member()
    p = post(author)
    client.post(f'{S}/posts/{p["id"]}/reactions', headers=x, json={'kind': 'like'})
    after = client.post(f'{S}/posts/{p["id"]}/reactions', headers=y, json={'kind': 'cheer'}).json()['post']
    assert after['reactions'] == {'like': 1, 'cheer': 1, 'clap': 0, 'hug': 0} and after['my_reaction'] == 'cheer'
    changed = client.post(f'{S}/posts/{p["id"]}/reactions', headers=y, json={'kind': 'hug'}).json()['post']
    assert changed['reactions']['cheer'] == 0 and changed['reactions']['hug'] == 1
    assert client.request('DELETE', f'{S}/posts/{p["id"]}/reactions', headers=x).json()['post']['reactions']['like'] == 0
    assert client.post(f'{S}/posts/{p["id"]}/reactions', headers=x, json={'kind': 'dislike'}).status_code == 422


def test_comments_can_be_deleted_by_their_author_or_the_post_author_only():
    _, author, _ = member(); _, writer, _ = member(); _, other, _ = member()
    p = post(author)
    c = client.post(f'{S}/posts/{p["id"]}/comments', headers=writer, json={'body': 'Nice one!'}).json()['comment']
    c2 = client.post(f'{S}/posts/{p["id"]}/comments', headers=writer, json={'body': 'Second'}).json()['comment']
    assert client.request('DELETE', f'{S}/comments/{c["id"]}', headers=other).status_code == 404
    assert client.request('DELETE', f'{S}/comments/{c["id"]}', headers=author).status_code == 200
    assert client.request('DELETE', f'{S}/comments/{c2["id"]}', headers=writer).status_code == 200
    assert client.get(f'{S}/posts/{p["id"]}/comments', headers=other).json()['comments'] == []
    assert client.post(f'{S}/posts/{p["id"]}/comments', headers=writer, json={'body': 'x' * 301}).status_code == 422


def test_three_reports_hide_a_post_until_a_moderator_decides():
    _, author, author_handle = member(); reporters = [member()[1] for _ in range(3)]
    p = post(author, 'Reported text')
    for i, h in enumerate(reporters):
        assert client.post(f'{S}/reports', headers=h, json={'target_type': 'post', 'target_id': p['id'], 'reason': 'harassment'}).status_code == 201
        assert client.post(f'{S}/reports', headers=h, json={'target_type': 'post', 'target_id': p['id'], 'reason': 'spam'}).status_code == 201  # counted once
        visible = p['id'] in ids(feed(member()[1], 'discover'))
        assert visible is (i < 2)
    assert client.get(f'{S}/moderation', headers=reporters[0]).status_code == 403
    mod_id, mod, _ = member()
    with database.SessionLocal() as db: db.get(models.User, mod_id).role = models.UserRole.admin; db.commit()
    queue = client.get(f'{S}/moderation', headers=mod).json()['queue']
    item = next(q for q in queue if q['target_id'] == p['id'])
    assert item['content'] == 'Reported text' and item['hidden'] is True and len(item['reasons']) == 3
    assert client.post(f'{S}/moderation', headers=mod, json={'target_type': 'post', 'target_id': p['id'], 'action': 'restore'}).json()['status'] == 'dismissed'
    assert p['id'] in ids(feed(member()[1], 'discover'))
    assert client.post(f'{S}/moderation', headers=mod, json={'target_type': 'post', 'target_id': p['id'], 'action': 'pause_posting'}).status_code == 200
    assert client.post(f'{S}/posts', headers=author, json={'body': 'again'}).status_code == 403


def test_the_feed_pages_newest_first_without_gaps_or_repeats():
    _, author, handle = member(); _, reader, _ = member()
    client.post(f'{S}/follow/{handle}', headers=reader)
    from datetime import timedelta
    from timeutil import utcnow
    author_id = client.get('/api/v1/auth/me', headers=author).json()['id']
    with database.SessionLocal() as db:  # 25 posts, more than the hourly posting limit allows through the API
        start = utcnow() - timedelta(hours=2)
        rows = [models.Post(author_id=author_id, body=f'Post {i}', created_at=start + timedelta(minutes=i)) for i in range(25)]
        db.add_all(rows); db.commit(); made = [r.id for r in rows]
    first = feed(reader); second = feed(reader, before=first['next'])
    assert len(first['posts']) == 20 and first['next'] and second['next'] is None
    assert ids(first) + ids(second) == list(reversed(made))


def test_deleted_posts_disappear_and_only_the_author_can_delete():
    _, author, _ = member(); _, other, _ = member()
    p = post(author)
    assert client.request('DELETE', f'{S}/posts/{p["id"]}', headers=other).status_code == 404
    assert client.request('DELETE', f'{S}/posts/{p["id"]}', headers=author).status_code == 200
    assert p['id'] not in ids(feed(other, 'discover'))


def test_an_export_includes_the_persons_social_data():
    owner, h, _ = member(); post(h, 'Mine to export')
    exported = client.get('/api/v1/users/export', headers=h).json()['account_records']
    assert exported['social_profile'] and exported['posts'][0]['body'] == 'Mine to export'


def test_the_browser_routes_allow_only_the_known_paths():
    from tests.test_web_gateway import browser, post as gpost, signed_up
    person = browser(); signed_up(person)
    assert person.put('/api/social/me', json={'handle': 'qa' + uuid.uuid4().hex[:8], 'display_name': 'QA'}, headers={'Origin': 'http://localhost'}).status_code == 200
    assert gpost(person, '/api/social/posts', {'body': 'From the browser'}).status_code == 201
    assert person.get('/api/social/feed?tab=discover').status_code == 200
    _, _, other = member()
    assert person.post(f'/api/social/follow/{other}', headers={'Origin': 'http://localhost'}).get_json() == {'status': 'active'}  # no body
    assert person.get('/api/social/../users/export').status_code == 404
    assert gpost(person, '/api/social/posts', {'body': 'x'}, origin='https://evil.example').status_code == 403


def test_posting_is_rate_limited():
    _, h, _ = member()
    statuses = [client.post(f'{S}/posts', headers=h, json={'body': f'n{i}'}).status_code for i in range(21)]
    assert statuses[:20] == [201] * 20 and statuses[20] == 429
