"""Spam controls (KI-39): repeated posts and comments, links from new accounts and link-only posts, a slower first day,
Discover waits a day for new accounts and shows at most 2 posts per person a page. Everyday posting is untouched."""
import uuid

import pytest

from tests.test_adventure import client
from tests.test_communities import C, community
from tests.test_social import S, feed, ids, member, post


@pytest.fixture(autouse=True)
def flags(monkeypatch):
    monkeypatch.setenv('FEATURE_SOCIAL_FEED', 'true'); monkeypatch.setenv('FEATURE_COMMUNITIES', 'true')


def send(h, body):
    return client.post(f'{S}/posts', headers=h, json={'body': body})


def test_the_same_post_twice_is_refused_but_different_posts_are_fine():
    _, h, _ = member()
    assert send(h, 'Morning run done, 5 km!').status_code == 201
    r = send(h, '  morning run DONE,   5 km!  ')
    assert r.status_code == 409 and 'already' in r.json()['detail']
    assert send(h, 'Evening walk with the family').status_code == 201


def test_the_same_comment_again_and_again_is_refused():
    _, author, _ = member(); _, h, _ = member()
    targets = [post(author, f'Post {i} {uuid.uuid4().hex[:6]}') for i in range(3)]
    codes = [client.post(f"{S}/posts/{p['id']}/comments", headers=h, json={'body': 'Follow me for tips'}).status_code for p in targets]
    assert codes == [201, 201, 409]
    assert client.post(f"{S}/posts/{targets[2]['id']}/comments", headers=h, json={'body': 'Great pace!'}).status_code == 201


def test_new_accounts_cannot_post_links_and_nobody_can_post_only_links():
    _, new, _ = member(new=True); _, settled, _ = member()
    r = send(new, 'Check www.cheap-pills.xyz now')
    assert r.status_code == 422 and '3 days' in r.json()['detail']
    assert send(settled, 'My route today, see https://example.org/route/42 for the map').status_code == 201
    assert send(settled, 'https://a.example.com https://b.example.com').status_code == 422
    assert send(settled, 'runclub.com fitpro.in yoga.org gym.co and a long sentence so the links are not most of the text here').status_code == 422
    assert send(settled, 'Ran 5.5 km in 31 min, felt great. Version 2.0 of my plan!').status_code == 201   # numbers are not links


def test_a_new_account_posts_more_slowly_on_its_first_day():
    _, h, _ = member(new=True)
    codes = [send(h, f'Day one note {i}').status_code for i in range(7)]
    assert codes[:5] == [201] * 5 and codes[5] == 429


def test_discover_waits_a_day_for_new_accounts_but_followers_see_them_at_once():
    _, new, handle = member(new=True); _, follower, _ = member(); _, viewer, _ = member()
    assert client.post(f'{S}/follow/{handle}', headers=follower).status_code in (200, 201)
    p = post(new, 'First post here')
    assert p['id'] in ids(feed(follower))
    assert p['id'] not in ids(feed(viewer, 'discover'))


def test_discover_shows_at_most_two_posts_per_person_a_page():
    _, loud, _ = member(); _, viewer, _ = member()
    mine = [post(loud, f'Update number {i} {uuid.uuid4().hex[:6]}')['id'] for i in range(5)]
    shown = [i for i in ids(feed(viewer, 'discover')) if i in mine]
    assert len(shown) == 2                                   # posted in the same second here, so which two is not fixed
    assert set(mine) <= set(ids(feed(loud)))                # the author still sees all of their own


def test_community_posts_follow_the_same_rules():
    _, h, _ = member()
    slug = community(h)
    assert client.post(f'{C}/{slug}/posts', headers=h, json={'body': 'Club run Sunday 6am'}).status_code == 201
    assert client.post(f'{C}/{slug}/posts', headers=h, json={'body': 'Club run Sunday 6am'}).status_code == 409
