"""Browser routes under /api/* (ported from the Next.js route tests): cookie sessions, origin checks, input
limits, sanitized errors, and the AI / barcode / food-search adapters. Only the internet is stubbed."""
import json
import threading
import uuid

import httpx
import pytest

from flask_app import web_gateway
from routers import auth
from tests.client import app

ITEM = {'name': 'Egg', 'quantity_g': 50, 'calories': 78, 'protein_g': 6.3, 'carbs_g': .6, 'fat_g': 5.3, 'confidence': .8}


class Fake:
    def __init__(self, status=200, body=None, text=''):
        self.status_code, self._body, self.text = status, body, text

    def json(self):
        if self._body is None: raise ValueError('not JSON')
        return self._body


def model_reply(content, model=None):
    return Fake(200, {'choices': [{'message': {'content': content}}], **({'model': model} if model else {})})


@pytest.fixture(autouse=True)
def environment(monkeypatch):
    for name in ('PUBLIC_APP_URL', 'ENABLE_LOCAL_AI', 'ENABLE_AUTHENTICATED_AI', 'OPENROUTER_MODEL'):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv('APP_ENV', 'testing'); monkeypatch.setenv('OPENROUTER_API_KEY', 'unit-test-key')


@pytest.fixture(autouse=True)
def no_cached_barcodes():
    """Lookups are cached in the database, so a real scan of a test barcode would otherwise change these results."""
    import database, models
    with database.SessionLocal() as db:
        db.query(models.BarcodeCache).filter(models.BarcodeCache.barcode.in_(('3017620422003', '5449000000996'))).delete(synchronize_session=False); db.commit()


@pytest.fixture
def internet(monkeypatch):
    calls, replies = [], []
    def fake(method, url, **kwargs):
        calls.append({'method': method, 'url': url, **kwargs})
        reply = replies.pop(0) if replies else Fake(500)
        if isinstance(reply, Exception): raise reply
        return reply
    monkeypatch.setattr(web_gateway, '_external', fake)
    from services import barcode_lookup  # barcode lookups go through the shared service
    monkeypatch.setattr(barcode_lookup, '_http_get', lambda url: fake('GET', url)); monkeypatch.setattr(barcode_lookup, 'breaker', barcode_lookup._Breaker())
    return calls, replies


@pytest.fixture
def inner(monkeypatch):
    """Record the in-process API calls the gateway makes."""
    seen, real = [], web_gateway.api
    def spy(method, path, token=None, body=None, form=None):
        seen.append((method, path, token)); return real(method, path, token, body, form)
    monkeypatch.setattr(web_gateway, 'api', spy)
    return seen


def browser():
    return app.test_client()


def post(client, path, body, origin='http://localhost', raw=None):
    headers = {'Origin': origin} if origin else {}
    return client.post(path, data=raw if raw is not None else json.dumps(body), headers={**headers, 'Content-Type': 'application/json'})


def signed_up(client):
    email, password = f'qa-gw-{uuid.uuid4().hex}@tests.example.com', 'Synthetic-gateway-123!'
    assert post(client, '/api/account/signup', {'email': email, 'password': password}).status_code == 200
    return email, password


# ── Account ─────────────────────────────────────────────────────────────────

def test_rejects_cross_origin_account_mutations(inner):
    assert post(browser(), '/api/account/login', {}, origin='https://evil.example').status_code == 403
    assert inner == []


def test_rejects_unknown_actions_and_malformed_input(inner):
    c = browser()
    assert post(c, '/api/account/admin', {}).status_code == 404
    assert post(c, '/api/account/login', None).status_code == 400
    assert post(c, '/api/account/login', {}).status_code == 400
    assert inner == []


def test_login_keeps_tokens_in_http_only_cookies():
    c = browser(); email, password = signed_up(c)
    assert post(c, '/api/account/logout', {}).status_code == 200
    response = post(c, '/api/account/login', {'email': email, 'password': password})
    assert response.status_code == 200 and response.get_json() == {'status': 'Signed in'}
    assert 'token' not in response.get_data(as_text=True)
    cookies = response.headers.getlist('Set-Cookie')
    assert any(h.startswith('trackcal_access=') and 'HttpOnly' in h and 'SameSite=Lax' in h for h in cookies)
    assert c.get('/api/account/session').get_json()['email'] == email


def test_returns_a_useful_credential_error():
    response = post(browser(), '/api/account/login', {'email': 'nobody@tests.example.com', 'password': 'Wrong-password-1'})
    assert response.status_code == 401 and response.get_json() == {'error': 'Invalid credentials'}


def test_refreshes_expired_sessions_and_retries_the_request():
    c = browser(); email, _ = signed_up(c)
    c.delete_cookie('trackcal_access')  # access token gone; refresh cookie remains
    response = c.get('/api/account/session')
    assert response.status_code == 200 and response.get_json()['email'] == email
    assert c.get_cookie('trackcal_access') is not None


def test_rejects_unauthenticated_backups(inner):
    response = browser().get('/api/account/backup')
    assert response.status_code == 401 and response.get_json() == {'error': 'Please sign in to continue.'}
    assert inner == []


def test_signs_out_and_clears_both_cookies():
    c = browser(); signed_up(c)
    assert post(c, '/api/account/logout', {}).status_code == 200
    assert c.get_cookie('trackcal_access') is None and c.get_cookie('trackcal_refresh') is None


def test_reports_outages_without_exposing_details(monkeypatch):
    def broken(*_args, **_kwargs): raise RuntimeError('internal password detail')
    monkeypatch.setattr(web_gateway, 'api', broken)
    response = post(browser(), '/api/account/login', {'email': 'a@example.com', 'password': 'password'})
    assert response.status_code == 503 and 'internal' not in response.get_data(as_text=True)


def test_closing_requires_confirmation_and_clears_cookies():
    c = browser(); signed_up(c)
    assert post(c, '/api/account/close', {'confirmation': 'yes'}).status_code == 400
    closed = post(c, '/api/account/close', {'confirmation': 'DELETE'})
    assert closed.status_code == 200 and closed.get_json()['status'] == 'account_closed'
    assert c.get_cookie('trackcal_access') is None


def test_api_sees_the_browser_address_for_per_ip_limits(monkeypatch):
    monkeypatch.setenv('APP_ENV', 'production'); monkeypatch.delenv('SMTP_HOST', raising=False)
    def attempt(ip):
        return app.test_client().post('/api/account/login', data=json.dumps({'email': f'qa-gw-{uuid.uuid4().hex}@tests.example.com', 'password': 'Wrong-password-1'}),
                                      headers={'Content-Type': 'application/json'}, environ_base={'REMOTE_ADDR': ip})
    ip = f'203.0.113.{uuid.uuid4().int % 250 + 1}'
    assert [attempt(ip).status_code for _ in range(auth.LOGIN_PER_IP + 1)][-1] == 429
    assert attempt('198.51.100.30').status_code == 401


# ── AI estimates ────────────────────────────────────────────────────────────

@pytest.mark.parametrize('body', [None, [], {}, {'text': ''}, {'text': 'x' * 4001}, {'image': 'data:text/html;base64,aGVsbG8='}])
def test_ai_rejects_invalid_bodies(body, internet):
    assert post(browser(), '/api/analyze', body).status_code == 400


def test_ai_rejects_malformed_json(internet):
    assert post(browser(), '/api/analyze', None, raw='{').status_code == 400


def test_ai_rejects_a_spoofed_png_without_calling_the_provider(internet):
    calls, _ = internet
    assert post(browser(), '/api/analyze', {'image': 'data:image/png;base64,aGVsbG8='}).status_code == 400
    assert calls == []


def test_ai_rejects_foreign_origins(internet):
    assert post(browser(), '/api/analyze', {'text': 'Egg'}, origin='https://untrusted.invalid').status_code == 403


def test_ai_accepts_the_apps_own_origin(internet):
    _, replies = internet; replies.append(model_reply(json.dumps({'components': [ITEM]})))
    assert post(browser(), '/api/analyze', {'text': 'Egg'}, origin='http://localhost').status_code == 200


def test_ai_requires_server_configuration(internet, monkeypatch):
    monkeypatch.setenv('OPENROUTER_API_KEY', '')
    assert post(browser(), '/api/analyze', {'text': 'Egg'}).status_code == 503


def test_ai_is_disabled_by_default_in_production(internet, monkeypatch):
    monkeypatch.setenv('APP_ENV', 'production')
    assert post(browser(), '/api/analyze', {'text': 'Egg'}).status_code == 503


def test_ai_recomputes_nutrition_and_keeps_credentials_out(internet):
    calls, replies = internet; replies.append(model_reply(json.dumps({'components': [ITEM], 'total_nutrition': {'calories': 9000}}), model='test/free'))
    response = post(browser(), '/api/analyze', {'text': 'Egg'})
    data = response.get_json()
    assert response.status_code == 200 and data['total_nutrition']['calories'] == 78 and data['is_mock'] is False
    assert 'unit-test-key' not in response.get_data(as_text=True)
    # Named free vision models in fallback order, never the any-free-model router.
    from services.openrouter_client import DEFAULT_MODELS
    assert calls[0]['json']['models'] == list(DEFAULT_MODELS) and 'model' not in calls[0]['json']


def test_ai_sends_a_single_configured_model_as_one_model(internet, monkeypatch):
    monkeypatch.setenv('OPENROUTER_MODEL', 'example/vision-model:free')
    calls, replies = internet; replies.append(model_reply(json.dumps({'components': [ITEM]})))
    assert post(browser(), '/api/analyze', {'text': 'Egg'}).status_code == 200
    assert calls[0]['json']['model'] == 'example/vision-model:free' and 'models' not in calls[0]['json']


@pytest.mark.parametrize('status', [401, 429, 503])
def test_ai_provider_errors_are_visible_and_sanitized(status, internet):
    _, replies = internet; replies.append(Fake(status, text='private upstream credential details'))
    response = post(browser(), '/api/analyze', {'text': 'Egg'})
    assert response.status_code == (429 if status == 429 else 502) and 'private upstream' not in response.get_data(as_text=True)


def test_ai_does_not_turn_malformed_output_into_food(internet):
    _, replies = internet; replies += [model_reply('not JSON'), model_reply('not JSON')]
    assert post(browser(), '/api/analyze', {'text': 'Egg'}).status_code == 502


def test_ai_retries_one_malformed_reply_and_requests_json_mode(internet):
    calls, replies = internet; replies += [model_reply('invalid'), model_reply(json.dumps({'components': [ITEM]}))]
    assert post(browser(), '/api/analyze', {'text': 'Egg'}).status_code == 200
    assert len(calls) == 2 and calls[0]['json']['response_format']['type'] == 'json_object'


def test_ai_limits_concurrent_scans_and_releases_slots(monkeypatch):
    entered, release, results = threading.Semaphore(0), threading.Event(), []
    def slow(method, url, **kwargs):
        entered.release(); release.wait(10); return model_reply(json.dumps({'components': [ITEM]}))
    monkeypatch.setattr(web_gateway, '_external', slow)
    monkeypatch.setattr(web_gateway, '_ai_allowance', lambda: None)  # threads can't share the test's DB connection; caps are tested separately
    workers = [threading.Thread(target=lambda: results.append(post(browser(), '/api/analyze', {'text': 'Egg'}).status_code)) for _ in range(2)]
    for w in workers: w.start()
    assert entered.acquire(timeout=10) and entered.acquire(timeout=10)
    assert post(browser(), '/api/analyze', {'text': 'Third meal'}).status_code == 429
    release.set()
    for w in workers: w.join(10)
    assert results == [200, 200]
    assert post(browser(), '/api/analyze', {'text': 'Egg'}).status_code == 200  # slots were released


def test_ai_never_calls_the_provider_when_the_account_quota_is_denied(internet, monkeypatch):
    calls, _ = internet
    monkeypatch.setenv('APP_ENV', 'production'); monkeypatch.setenv('ENABLE_AUTHENTICATED_AI', 'true')
    response = post(browser(), '/api/analyze', {'text': 'one egg'})  # no session: quota check refuses
    assert response.status_code == 401 and calls == []


def test_configured_public_origin_is_the_only_one_accepted(monkeypatch, internet):
    monkeypatch.setenv('PUBLIC_APP_URL', 'https://trackcal.example')
    _, replies = internet; replies.append(model_reply(json.dumps({'components': [ITEM]})))
    assert post(browser(), '/api/analyze', {'text': 'Egg'}, origin='https://trackcal.example').status_code == 200
    assert post(browser(), '/api/analyze', {'text': 'Egg'}, origin='https://attacker.example').status_code == 403


# ── Barcode and food search ─────────────────────────────────────────────────

@pytest.mark.parametrize('code', ['abc', '123', '../foo'])
def test_barcode_rejects_invalid_codes(code, internet):
    assert browser().get(f'/api/barcode?code={code}').status_code == 400


def test_barcode_keeps_legitimate_zeros_and_unknown_nova(internet):
    _, replies = internet
    replies.append(Fake(200, {'status': 1, 'product': {'product_name': 'Water', 'nutriments': {'energy-kcal_100g': 0, 'proteins_100g': 0, 'carbohydrates_100g': 0, 'fat_100g': 0}}}))
    response = browser().get('/api/barcode?code=3017620422003'); data = response.get_json()
    assert response.status_code == 200 and data['nutrients_per_100g']['energy_kcal'] == 0 and data['nova_group'] is None


def test_barcode_returns_unknowns_as_null_rather_than_inventing_zeros(internet):
    _, replies = internet; replies.append(Fake(200, {'status': 1, 'product': {'nutriments': {}}}))
    response = browser().get('/api/barcode?code=3017620422003'); data = response.get_json()
    assert response.status_code == 200 and data['complete'] is False
    assert set(data['nutrients_per_100g'].values()) == {None} and 'Open Food Facts' in data['attribution']


def test_barcode_reports_not_found_and_timeouts(internet):
    import httpx
    _, replies = internet; replies += [Fake(200, {'status': 0}), httpx.ReadTimeout('slow'), httpx.ReadTimeout('slow')]
    assert browser().get('/api/barcode?code=3017620422003').status_code == 404
    assert browser().get('/api/barcode?code=5449000000996').status_code == 502  # a timeout, retried once


def test_food_search_validates_and_keeps_only_complete_records(internet, monkeypatch):
    monkeypatch.setattr('flask_app.web_gateway._world_foods', lambda query, limit: [])
    _, replies = internet
    monkeypatch.setattr('flask_app.web_gateway._catalog_foods', lambda query: [])
    assert browser().get('/api/foods?q=').status_code == 400
    replies.append(Fake(200, {'foods': [
        {'fdcId': 1, 'description': 'Test banana', 'foodNutrients': [{'nutrientName': 'Energy', 'unitName': 'KCAL', 'value': 89}, {'nutrientName': 'Protein', 'value': 1.1},
                                                                    {'nutrientName': 'Carbohydrate, by difference', 'value': 22.8}, {'nutrientName': 'Total lipid (fat)', 'value': .3}]},
        {'fdcId': 2, 'description': 'Incomplete', 'foodNutrients': []}]}))
    results = browser().get('/api/foods?q=banana').get_json()['results']
    assert len(results) == 1 and results[0]['name'] == 'Test banana' and results[0]['calories'] == 89 and results[0]['serving_size'] == '100g'


def test_the_catalog_answers_first_and_needs_no_outside_service(internet, monkeypatch):
    calls, _ = internet
    foods = [{'id': str(i), 'name': f'Food {i}'} for i in range(12)]
    monkeypatch.setattr('flask_app.web_gateway._catalog_foods', lambda query: foods)
    assert browser().get('/api/foods?q=banana').get_json()['results'] == foods and calls == []


def test_food_search_reports_limits_and_failures_without_fabricated_food(internet, monkeypatch):
    monkeypatch.setattr('flask_app.web_gateway._world_foods', lambda query, limit: [])
    monkeypatch.setattr('flask_app.web_gateway._catalog_foods', lambda query: [])
    _, replies = internet; replies += [Fake(429, text='limit'), ConnectionError('offline')]
    assert browser().get('/api/foods?q=banana').status_code == 429
    assert browser().get('/api/foods?q=banana').status_code == 502


# ── Proxied modules ─────────────────────────────────────────────────────────

def test_tools_require_a_session_and_validate_before_calling_the_api(inner):
    c = browser()
    assert c.get('/api/tools/status').status_code == 401
    assert post(c, '/api/tools/plan', {}, origin='https://elsewhere.example').status_code == 403
    assert c.get('/api/tools/admin').status_code == 404
    assert post(c, '/api/tools/plan', None, raw='{').status_code == 400
    assert inner == []


def test_tools_forward_only_allowlisted_queries(monkeypatch):
    seen = []  # stubbed: the real prices integration would call a public price service
    monkeypatch.setattr(web_gateway, 'api', lambda method, path, token=None, body=None, form=None: seen.append((path, token)) or web_gateway.Upstream(200, {'observations': []}))
    c = browser(); c.set_cookie('trackcal_access', 'test-access')
    response = c.get('/api/tools/prices?code=3017620422003&currency=EUR&url=http://internal&api_key=private')
    path, token = seen[0]
    assert response.status_code == 200 and token == 'test-access' and 'test-access' not in response.get_data(as_text=True)
    assert 'code=3017620422003' in path and 'internal' not in path and 'private' not in path


def test_tools_keep_service_setup_errors_visible(monkeypatch):
    c = browser(); signed_up(c)
    monkeypatch.setattr(web_gateway, 'api', lambda *a, **k: web_gateway.Upstream(503, {'detail': 'Grocy needs configuration'}))
    c.set_cookie('trackcal_access', 'any')
    response = c.get('/api/tools/grocy')
    assert response.status_code == 503 and response.get_json() == {'error': 'Grocy needs configuration'}


def test_personalization_allowlist_origin_ids_and_limits(inner):
    c = browser(); signed_up(c); inner.clear()
    assert c.get('/api/personalization/state').status_code == 200 and inner[-1][1] == '/personalization/state'
    calls = len(inner)
    assert c.get('/api/personalization/users/other').status_code == 404
    assert post(c, '/api/personalization/onboarding', {}, origin='https://elsewhere.example').status_code == 403
    assert c.delete('/api/personalization/measurements/invalid', headers={'Origin': 'http://localhost'}).status_code == 404
    assert post(c, '/api/personalization/onboarding', None, raw='[]').status_code == 400
    assert post(c, '/api/personalization/onboarding', None, raw='x' * 17000).status_code == 413
    assert len(inner) == calls
    assert browser().get('/api/personalization/state').status_code == 401


def test_wellness_filters_resources_and_updates(inner):
    c = browser(); signed_up(c); inner.clear()
    c.get('/api/wellness/foods?q=dosa&offset=12&secret=x')
    assert inner[-1][1] == '/wellness/foods?q=dosa&offset=12'
    calls = len(inner)
    assert post(c, '/api/wellness/diary', {}, origin='https://elsewhere.example').status_code == 403
    assert c.get('/api/wellness/users/private').status_code == 404
    assert len(inner) == calls
    c.put('/api/wellness/sessions/abc-123', data='{}', headers={'Origin': 'http://localhost', 'Content-Type': 'application/json'})
    assert inner[-1][1] == '/wellness/sessions/abc-123'


def test_created_responses_keep_their_status():
    with app.test_request_context():
        response = web_gateway.forward(web_gateway.Upstream(201, {'id': 'appointment'}))
    assert response.status_code == 201 and response.get_json() == {'id': 'appointment'}


def test_public_health_reports_status_only(monkeypatch):
    import database
    assert browser().get('/api/health').get_json() == {'status': 'ok'}
    monkeypatch.setattr(database, 'verify_connection', lambda: False)
    response = browser().get('/api/health')
    assert response.status_code == 503 and response.get_json() == {'status': 'degraded'}


def test_barcode_digits_are_used_only_with_a_valid_check_digit(internet):
    calls, replies = internet
    from tests.test_photo_scan import phone_photo
    replies.append(model_reply('{"digits":"3017620422003"}'))
    good = post(browser(), '/api/barcode/read', {'image': phone_photo()})
    assert good.status_code == 200 and good.get_json()['code'] == '3017620422003'
    for guess in ('{"digits":"00260435515790"}', '{"digits":"000000000000"}', '{"digits":""}', 'not json'):
        replies.append(model_reply(guess))
        assert post(browser(), '/api/barcode/read', {'image': phone_photo()}).status_code == 422


def test_world_foods_keep_complete_records_and_never_break_search(internet):
    from flask_app.web_gateway import _world_foods
    _, replies = internet
    good = {'code': '1', 'product_name': 'Pierogi', 'brands': ['Virtu'], 'countries_tags': ['en:poland'], 'nutriments': {'energy-kcal_100g': 190, 'proteins_100g': 6, 'carbohydrates_100g': 30, 'fat_100g': 4}}
    replies.append(Fake(200, {'hits': [good, {'code': '2', 'product_name': 'No numbers', 'nutriments': {}}]}))
    found = _world_foods('pierogi', 12)
    assert len(found) == 1 and found[0]['name'] == 'Pierogi — Virtu' and found[0]['cuisine'] == 'Poland' and found[0]['calories'] == 190
    replies.append(httpx.ReadTimeout('slow'))
    assert _world_foods('pierogi', 12) == []


def test_activities_go_through_the_gateway_end_to_end(inner):
    from datetime import datetime, timedelta, timezone
    from tests.test_activities_helpers import fixes_for
    c = browser(); signed_up(c)
    body = {'sport': 'run', 'started_at': (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(), 'fixes': fixes_for([(900, 3)])}
    saved = post(c, '/api/activities', body)
    assert saved.status_code == 201, saved.get_data(as_text=True)
    activity = saved.get_json()['activity']
    assert activity['distance_m'] > 2500 and saved.get_json()['new_records']
    assert c.get('/api/activities?sport=run').get_json()['activities'][0]['id'] == activity['id']
    assert c.get(f"/api/activities/{activity['id']}").get_json()['activity']['splits']
    assert c.patch(f"/api/activities/{activity['id']}", data=json.dumps({'name': 'Lake loop'}), headers={'Origin': 'http://localhost', 'Content-Type': 'application/json'}).get_json()['activity']['name'] == 'Lake loop'
    assert c.get('/api/activities/records?sport=run').get_json()['best_efforts']
    assert post(c, '/api/activities', body, origin='https://evil.example').status_code == 403
    assert c.get('/api/activities/../users/export').status_code == 404
    assert c.get('/api/activities/not-an-id').status_code == 404
    assert c.delete(f"/api/activities/{activity['id']}", headers={'Origin': 'http://localhost'}).status_code == 204
    assert browser().get('/api/activities').status_code == 401


def test_the_daily_check_in_reaches_the_api_through_the_gateway(inner):
    c = browser(); signed_up(c)
    assert post(c, '/api/adventure/initialize', {'timezone': 'UTC'}).status_code == 200
    first = post(c, '/api/adventure/check-in', {})
    assert first.status_code == 200, first.get_data(as_text=True)
    assert first.get_json()['awarded_xp'] == 5 and post(c, '/api/adventure/check-in', {}).get_json()['awarded_xp'] == 0
