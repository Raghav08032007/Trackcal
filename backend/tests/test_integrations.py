"""Real parser/optimizer tests; external protocols use deterministic HTTP fixtures."""
import base64
import io
import json
import socket
import uuid
import wave
from unittest.mock import AsyncMock
import httpx
import pytest
from fastapi import HTTPException
from tests.client import app, client
from routers import integrations
from services import safe_recipe


@pytest.fixture
def account_headers():
    response = client.post('/api/v1/auth/signup', json={'email': f'qa-{uuid.uuid4().hex}@tests.example.com', 'password': 'Test-pass-123'})
    data = response.json()
    return {'Authorization': 'Bearer ' + data['access_token']}, data['user_id']

def test_real_ingredient_parser_preserves_unknown_weights():
    result = integrations.parse_lines(['200 g rice', '1 cup flour', '2 eggs', '1 kg potatoes'])
    assert result[0]['name'] == 'rice' and result[0]['grams'] == 200
    assert result[1]['grams'] is None and result[1]['needs_review']
    assert result[2]['grams'] is None
    assert result[3]['grams'] == 1000

def test_ingredient_api_requires_review_and_has_no_fabricated_nutrition(account_headers):
    headers, _ = account_headers
    response = client.post('/api/v1/integrations/ingredients', headers=headers, json={'lines': ['200 g rice']})
    assert response.status_code == 200
    assert response.json()['nutrition'] is None
    assert client.post('/api/v1/integrations/ingredients', headers=headers, json={'lines': ['x' * 401]}).status_code == 422

def recipe_html():
    return '<html><script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@type': 'Recipe', 'name': 'Test rice bowl', 'recipeYield': '2 servings', 'recipeIngredient': ['200 g rice', '1 cup vegetables'], 'recipeInstructions': ['Cook rice.', 'Add vegetables.']}) + '</script></html>'

def test_real_recipe_scraper_imports_structured_recipe(account_headers, monkeypatch):
    headers, _ = account_headers
    monkeypatch.setattr(integrations, 'fetch_recipe_html', lambda url: (recipe_html(), url))
    response = client.post('/api/v1/integrations/recipe-import', headers=headers, json={'url': 'https://example.com/recipe'})
    assert response.status_code == 200, response.text
    value = response.json()
    assert value['name'] == 'Test rice bowl' and value['ingredients'][0]['grams'] == 200
    assert value['ingredients'][1]['grams'] is None and value['nutrition'] is None
    assert 'Cook rice' in value['instructions']

def test_nonrecipe_never_becomes_sample_data():
    with pytest.raises(HTTPException) as error: integrations.extract_recipe('<html>No recipe</html>', 'https://example.com')
    assert error.value.status_code == 422

@pytest.mark.parametrize('url', ['http://example.com/a', 'file:///etc/passwd', 'https://user:pass@example.com', 'https://example.com:8000', 'https://example.com:bad', 'https://[invalid'])
def test_rejects_unsafe_recipe_urls(url):
    with pytest.raises(HTTPException) as error: safe_recipe.public_target(url)
    assert error.value.status_code == 422

@pytest.mark.parametrize('address', ['127.0.0.1', '10.1.2.3', '192.168.1.5', '169.254.169.254', '::1', 'fc00::1', '0.0.0.0'])
def test_dns_to_private_network_is_rejected(monkeypatch, address):
    monkeypatch.setattr(socket, 'getaddrinfo', lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (address, 443))])
    with pytest.raises(HTTPException): safe_recipe.public_target('https://public-looking.example/recipe')

def test_dns_pinning_returns_verified_public_address(monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', lambda *a, **k: [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443))])
    parsed, address = safe_recipe.public_target('https://example.com/recipe')
    assert address == '93.184.216.34' and parsed.hostname == 'example.com'

def candidate(identifier, calories=600, protein=30, cost=80, tags=None):
    return {'id': identifier, 'name': identifier, 'calories': calories, 'protein': protein, 'carbs': 50, 'fat': 10, 'cost': cost, 'minutes': 20, 'tags': tags or []}

def test_real_optimizer_enforces_budget_variety_and_exclusions(account_headers):
    headers, _ = account_headers
    body = {'foods': [candidate('one'), candidate('two', cost=50), candidate('milk', cost=1, tags=['Milk'])], 'slots': 2, 'calories_min': 1000, 'calories_max': 1500, 'protein_min': 50, 'budget': 150, 'excluded_tags': ['milk']}
    response = client.post('/api/v1/integrations/plan', headers=headers, json=body)
    assert response.status_code == 200, response.text
    result = response.json()
    assert {meal['id'] for meal in result['meals']} == {'one', 'two'}
    assert result['totals']['cost'] == 130 and result['totals']['calories'] == 1200
    body['budget'] = 10
    result = client.post('/api/v1/integrations/plan', headers=headers, json=body).json()
    assert result['status'] == 'infeasible' and result['meals'] == []

def test_optimizer_does_not_round_over_budget(account_headers):
    headers, _ = account_headers
    result = client.post('/api/v1/integrations/plan', headers=headers, json={'foods': [candidate('x', cost=10.001)], 'slots': 1, 'calories_min': 100, 'calories_max': 1000, 'protein_min': 0, 'budget': 10}).json()
    assert result['status'] == 'infeasible'

def test_optimizer_rejects_duplicate_ids_and_inverted_limits(account_headers):
    headers, _ = account_headers
    for body in [{'foods': [candidate('x'), candidate('x')]}, {'foods': [candidate('x')], 'calories_min': 2000, 'calories_max': 1000}]:
        assert client.post('/api/v1/integrations/plan', headers=headers, json=body).status_code == 422

def test_shopping_subtracts_exact_stock_and_excludes_expired_items(account_headers):
    headers, _ = account_headers
    result = client.post('/api/v1/integrations/shopping', headers=headers, json={'today': '2026-10-21', 'ingredients': [{'name': ' Rice ', 'grams': 100}, {'name': 'rice', 'grams': 50}], 'pantry': [{'name': 'RICE', 'grams': 40, 'expires': '2026-10-22'}, {'name': 'rice', 'grams': 100, 'expires': '2026-10-20'}]}).json()
    assert result['items'][0]['buy_g'] == 110 and result['expired_excluded'] == 1

def test_missing_household_services_are_explicit(account_headers, monkeypatch):
    headers, _ = account_headers
    for service in ['GROCY', 'MEALIE']:
        monkeypatch.delenv(service + '_URL', raising=False)
        assert client.get('/api/v1/integrations/' + service.lower(), headers=headers).status_code == 503

def test_grocy_owner_guard_and_stock_units(account_headers, monkeypatch):
    headers, owner = account_headers
    monkeypatch.setenv('GROCY_URL', 'http://grocy.local')
    monkeypatch.setenv('GROCY_API_KEY', 'fixture-secret')
    monkeypatch.setenv('INTEGRATION_OWNER_ID', 'another-owner')
    assert client.get('/api/v1/integrations/grocy', headers=headers).status_code == 403
    monkeypatch.setenv('INTEGRATION_OWNER_ID', owner)
    call = AsyncMock(return_value=[{'product_id': 1, 'product': {'name': 'Rice', 'qu_id_stock': 3}, 'amount': 2, 'best_before_date': '2026-10-25'}])
    monkeypatch.setattr(integrations, 'service_json', call)
    result = client.get('/api/v1/integrations/grocy', headers=headers).json()
    assert result['items'][0]['grams'] is None and result['items'][0]['amount'] == 2
    assert call.call_args.args[1] == '/api/stock'
    assert 'fixture-secret' not in json.dumps(result)

def test_mealie_list_and_recipe_parsing(account_headers, monkeypatch):
    headers, owner = account_headers
    monkeypatch.setenv('MEALIE_URL', 'http://mealie.local')
    monkeypatch.setenv('MEALIE_API_KEY', 'fixture-secret')
    monkeypatch.setenv('INTEGRATION_OWNER_ID', owner)
    call = AsyncMock(side_effect=[{'items': [{'id': '1', 'name': 'Rice', 'slug': 'rice'}], 'total': 1}, {'name': 'Rice', 'recipeIngredient': [{'display': '200 g rice'}], 'recipeInstructions': [{'text': 'Cook'}]}])
    monkeypatch.setattr(integrations, 'service_json', call)
    assert client.get('/api/v1/integrations/mealie', headers=headers).json()['recipes'][0]['slug'] == 'rice'
    result = client.get('/api/v1/integrations/mealie-recipe?slug=rice', headers=headers).json()
    assert result['ingredients'][0]['grams'] == 200 and result['nutrition'] is None
    assert client.get('/api/v1/integrations/mealie-recipe?slug=../secret', headers=headers).status_code == 422

def test_wger_translation_attribution_and_html_stripping(account_headers, monkeypatch):
    headers, _ = account_headers
    monkeypatch.setattr(integrations, 'service_json', AsyncMock(return_value={'results': [{'id': 1, 'translations': [{'language': 2, 'name': 'Squat', 'description': '<p>Stand up.</p>'}], 'license': {'short_name': 'CC-BY-SA 4', 'url': 'https://creativecommons.org/licenses/by-sa/4.0/'}, 'license_author': 'Contributor'}]}))
    result = client.get('/api/v1/integrations/exercises?query=squat', headers=headers).json()
    assert result['exercises'][0]['description'] == 'Stand up.' and result['exercises'][0]['license_author'] == 'Contributor'
    assert result['exercises'][0]['license'] == 'CC-BY-SA 4'

def test_prices_do_not_mix_currencies_or_invent_missing_results(account_headers, monkeypatch):
    headers, _ = account_headers
    monkeypatch.setattr(integrations, 'service_json', AsyncMock(return_value={'items': [{'id': 1, 'price': '2.5', 'currency': 'EUR', 'price_per': 'UNIT'}, {'id': 2, 'price': 10, 'currency': 'INR'}]}))
    result = client.get('/api/v1/integrations/prices?code=3017620422003&currency=EUR', headers=headers).json()
    assert len(result['observations']) == 1 and result['observations'][0]['price'] == 2.5
    assert client.get('/api/v1/integrations/prices?code=bad', headers=headers).status_code == 422

def test_label_parser_keeps_unknown_values_and_ambiguous_basis_unknown():
    result = integrations.parse_label('Per 100g\nEnergy 836.8 kJ\nProtein 12000 mg\nCarbohydrates 20 g\nSaturated fat 2g\nTotal fat 8g')
    assert result['values'] == {'calories': 200, 'protein': 12, 'carbs': 20, 'fat': 8} and result['basis'] == 'per_100g'
    assert integrations.parse_label('Per serving and per 100g')['basis'] == 'unknown'
    assert integrations.parse_label('Unreadable')['values']['calories'] is None

def test_label_upload_calls_local_worker_with_valid_image(account_headers, monkeypatch):
    from PIL import Image
    headers, _ = account_headers
    image = io.BytesIO(); Image.new('RGB', (50, 50), 'white').save(image, format='PNG')
    monkeypatch.setenv('PADDLEOCR_URL', 'http://worker.local')
    real_client = httpx.AsyncClient
    def respond(request):
        assert request.url.path == '/ocr'
        return httpx.Response(200, json={'text': 'Per serving\nCalories 200\nProtein 12g\nCarbohydrates 20g\nTotal fat 8g'})
    monkeypatch.setattr(integrations.httpx, 'AsyncClient', lambda **kwargs: real_client(transport=httpx.MockTransport(respond)))
    result = client.post('/api/v1/integrations/label', headers=headers, json={'data': base64.b64encode(image.getvalue()).decode()})
    assert result.status_code == 200 and result.json()['values']['calories'] == 200
    assert client.post('/api/v1/integrations/label', headers=headers, json={'data': base64.b64encode(b'not an image').decode()}).status_code == 422

def test_voice_rejects_fake_wav_and_silent_audio(account_headers):
    headers, _ = account_headers
    assert client.post('/api/v1/integrations/transcribe', headers=headers, json={'data': base64.b64encode(b'not wav').decode()}).status_code == 422

def test_queued_backups_detect_cloud_conflicts_and_wrong_owner(account_headers):
    headers, owner = account_headers
    baseline = client.get('/api/v1/users/workspace', headers=headers).json()['revision']
    body = {'entries': {'trackcal:studio:pantry': []}, 'expected_revision': baseline, 'owner_id': owner}
    assert client.put('/api/v1/users/workspace', headers=headers, json=body).status_code == 200
    assert client.put('/api/v1/users/workspace', headers=headers, json=body).status_code == 409
    body['owner_id'] = 'someone-else'
    assert client.put('/api/v1/users/workspace', headers=headers, json=body).status_code == 403
