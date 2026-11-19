"""The word screen: hurtful or self-harm words hold a post for a moderator (nothing is deleted), self-harm words show a
helpline in the person's language, names and profiles with such words are refused, and everyday fitness talk passes."""
import pytest

from services.screening import screen
from tests.test_adventure import client
from tests.test_communities import C
from tests.test_item_reports import moderator
from tests.test_social import S, feed, ids, member


@pytest.fixture(autouse=True)
def flags(monkeypatch):
    for f in ('SOCIAL_FEED', 'COMMUNITIES', 'VERIFIED_EVENTS', 'VERIFIED_CHALLENGES'): monkeypatch.setenv(f'FEATURE_{f}', 'true')


@pytest.mark.parametrize('text', ['Did 10 suicide sprints today!', 'I hurt myself at the gym, knee is sore', 'Anjing saya ikut jalan pagi',
                                  'fagioli soup after the run', 'Great run everyone!', 'Lampu mau mati, latihan di rumah'])
def test_everyday_fitness_talk_passes(text):
    assert screen(text) is None


@pytest.mark.parametrize('text, kind', [('Feeling suicidal lately', 'self_harm'), ('मैं आत्महत्या के बारे में सोचता हूँ', 'self_harm'), ('quiero morir', 'self_harm'),
                                        ('bunuh diri', 'self_harm'), ('kys loser', 'abuse'), ('तू चूतिया है', 'abuse'), ('tu chutiya hai', 'abuse'),
                                        ('Great run, retard', 'abuse'), ('KYS', 'abuse')])
def test_flagged_words_are_found_in_every_script(text, kind):
    assert screen(text) == kind


def test_a_hurtful_post_is_held_for_a_moderator_and_nobody_else_sees_it():
    _, author, handle = member(); _, other, _ = member()
    assert client.post(f'{S}/follow/{handle}', headers=other).status_code in (200, 201)
    r = client.post(f'{S}/posts', headers=author, json={'body': 'Great run, retard'})
    assert r.status_code == 201 and r.json()['held'] == 'abuse' and 'moderator' in r.json()['notice']
    held_id = r.json()['post']['id']
    assert held_id not in ids(feed(other))
    queue = client.get(f'{S}/moderation', headers=moderator()).json()['queue']
    assert any(item['target_id'] == held_id and 'hate' in item['reasons'] and item['hidden'] for item in queue)


def test_self_harm_words_show_a_helpline_in_the_persons_language():
    _, author, _ = member()
    r = client.post(f'{S}/posts', headers={**author, 'Accept-Language': 'hi'}, json={'body': 'I want to end my life'})
    body = r.json()
    assert body['held'] == 'self_harm' and '14416' in body['notice'] and 'हेल्पलाइन' in body['notice']
    r = client.post(f'{S}/posts', headers=author, json={'body': 'Felt great after my walk'})
    assert 'held' not in r.json() and 'notice' not in r.json()


def test_a_comment_with_hurtful_words_is_held():
    _, author, _ = member(); _, other, _ = member()
    post_id = client.post(f'{S}/posts', headers=author, json={'body': 'Morning run done'}).json()['post']['id']
    r = client.post(f'{S}/posts/{post_id}/comments', headers=other, json={'body': 'kys'})
    assert r.status_code == 201 and r.json()['held'] == 'abuse'
    assert all(c['body'] != 'kys' for c in client.get(f'{S}/posts/{post_id}/comments', headers=author).json()['comments'])


def test_names_and_profiles_with_such_words_are_refused():
    _, h, handle = member()
    r = client.put(f'{S}/me', headers=h, json={'handle': handle, 'display_name': 'Runner', 'bio': 'kys', 'private': False})
    assert r.status_code == 422
    r = client.post(C, headers=h, json={'slug': 'run-club-x1', 'name': 'Fat pig runners', 'description': 'x', 'category': 'running', 'visibility': 'public'})
    assert r.status_code == 422
