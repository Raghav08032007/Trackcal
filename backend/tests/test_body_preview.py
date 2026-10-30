"""AI body preview behind `body_simulator`: off by default, adults only, consent on every call, fixed goals, nothing kept."""
import base64
import io

import httpx
import pytest
from PIL import Image

import database, models
from routers import body_preview
from tests.test_adventure import client
from tests.test_social import member as social_member

def member(): return social_member()[1]


U = '/api/v1/body-preview'
RESULT = 'data:image/png;base64,iVBORw0KGgo='


def photo():
    out = io.BytesIO(); Image.new('RGB', (64, 64), (120, 90, 60)).save(out, 'JPEG')
    return 'data:image/jpeg;base64,' + base64.b64encode(out.getvalue()).decode()


def body(**extra):
    return {'image': photo(), 'goal': 'toned', 'confirm_adult': True, 'confirm_own_photo': True, 'confirm_ai_transfer': True, **extra}


def aged(headers, group='20_64', minor=False):
    me = client.get('/api/v1/auth/me', headers=headers).json()['id']
    with database.SessionLocal() as db:
        user = db.get(models.User, me); user.is_minor = minor
        row = db.get(models.PersonalizationProfile, me) or models.PersonalizationProfile(user_id=me, preferences={}, step=6)
        row.preferences = {**(row.preferences or {}), 'age_group': group}; db.add(row); db.commit()
    return headers


class Reply:
    def __init__(self, status=200, data=None): self.status_code, self.data = status, data
    def json(self): return self.data


def ok(*_, **kwargs):
    ok.sent = kwargs['json']
    return Reply(data={'choices': [{'message': {'images': [{'image_url': {'url': RESULT}}]}}]})


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setenv('FEATURE_SOCIAL_FEED', 'true'); monkeypatch.setenv('FEATURE_BODY_SIMULATOR', 'true'); monkeypatch.setenv('OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setattr(body_preview.httpx, 'post', ok)


def test_off_by_default(monkeypatch):
    monkeypatch.delenv('FEATURE_BODY_SIMULATOR')
    h = aged(member())
    assert client.get(U, headers=h).status_code == 404
    assert client.post(U, headers=h, json=body()).status_code == 404


def test_needs_an_account():
    assert client.post(U, json=body()).status_code == 401


@pytest.mark.parametrize('group,minor', [('under18', False), ('unspecified', False), ('20_64', True)])
def test_refuses_anyone_not_known_to_be_an_adult(group, minor):
    h = aged(member(), group, minor)
    assert client.post(U, headers=h, json=body()).status_code == 403


def test_refuses_an_account_with_no_age_data():
    assert client.post(U, headers=member(), json=body()).status_code == 403


@pytest.mark.parametrize('field', ['confirm_adult', 'confirm_own_photo', 'confirm_ai_transfer'])
def test_every_consent_is_required(field):
    assert client.post(U, headers=aged(member()), json=body(**{field: False})).status_code == 422


def test_goals_are_fixed_and_free_text_is_rejected():
    h = aged(member())
    assert client.post(U, headers=h, json=body(goal='extremely thin')).status_code == 422
    assert client.post(U, headers=h, json=body(prompt='anything')).status_code == 422


def test_returns_an_illustration_and_keeps_the_rules_in_the_prompt():
    r = client.post(U, headers=aged(member()), json=body())
    assert r.status_code == 200, r.text
    assert r.json()['image'] == RESULT and 'not a prediction' in r.json()['notice']
    text = ok.sent['messages'][0]['content'][0]['text']
    assert 'under 18' in text and 'Do not sexualize' in text and 'Do not remove' in text


def test_three_a_day(monkeypatch):
    h = aged(member())
    assert [client.post(U, headers=h, json=body()).status_code for _ in range(4)] == [200, 200, 200, 429]


def test_a_model_refusal_is_explained(monkeypatch):
    monkeypatch.setattr(body_preview.httpx, 'post', lambda *a, **k: Reply(data={'choices': [{'message': {'content': 'I cannot do that'}}]}))
    r = client.post(U, headers=aged(member()), json=body())
    assert r.status_code == 422 and 'clothed photo of one adult' in r.text


def test_provider_details_never_reach_the_person(monkeypatch):
    monkeypatch.setattr(body_preview.httpx, 'post', lambda *a, **k: Reply(500, {'error': 'secret detail'}))
    r = client.post(U, headers=aged(member()), json=body())
    assert r.status_code == 502 and 'secret' not in r.text


def test_a_network_failure_is_handled(monkeypatch):
    def down(*a, **k): raise httpx.ConnectError('down')
    monkeypatch.setattr(body_preview.httpx, 'post', down)
    assert client.post(U, headers=aged(member()), json=body()).status_code == 502
