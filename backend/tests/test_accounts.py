import uuid
from tests.client import app, client

def signup():
    email = f"qa-{uuid.uuid4().hex}@tests.example.com"
    result = client.post('/api/v1/auth/signup', json={'email': email, 'password': 'Test-password-123'})
    assert result.status_code == 201, result.text
    return email, {'Authorization': 'Bearer ' + result.json()['access_token']}

def test_workspace_backup_and_owner_isolation():
    _, first = signup()
    _, second = signup()
    entries = {'trackcal:journal:2026-10-21': [{'name': 'Egg', 'calories': 78, 'protein': 6, 'carbs': 1, 'fat': 5, 'time': '12:00', 'method': 'Manual'}]}
    entries.update({'trackcal:play:theme':'neon','trackcal:play:motion':False,'trackcal:play:character':'pip'})
    assert client.put('/api/v1/users/workspace', headers=first, json={'entries': entries}).status_code == 200
    assert client.get('/api/v1/users/workspace', headers=first).json()['entries'] == entries
    assert client.get('/api/v1/users/workspace', headers=second).json()['entries'] == {}
    assert client.put('/api/v1/users/workspace', headers=first, json={'entries': {'trackcal:account:other': {}}}).status_code == 422

def test_change_password():
    email, headers = signup()
    assert client.post('/api/v1/auth/password', headers=headers, json={'current_password': 'wrong', 'new_password': 'New-password-123'}).status_code == 401
    assert client.post('/api/v1/auth/password', headers=headers, json={'current_password': 'Test-password-123', 'new_password': 'New-password-123'}).status_code == 200
    assert client.post('/api/v1/auth/login', data={'username': email, 'password': 'Test-password-123'}).status_code == 401
    assert client.post('/api/v1/auth/login', data={'username': email, 'password': 'New-password-123'}).status_code == 200

def test_signup_password_limits():
    for password in ['short', 'x' * 73, '💚' * 30]:
        assert client.post('/api/v1/auth/signup', json={'email': 'limits@tests.example.com', 'password': password}).status_code == 422


def test_every_key_the_app_saves_can_be_backed_up():
    """One refused key fails the whole backup, so a new saved setting must never be left off the server's list."""
    import re
    from pathlib import Path
    source = Path(__file__).resolve().parents[2] / 'frontend' / 'web' / 'src'
    keys = set()
    for path in [*source.rglob('*.ts'), *source.rglob('*.tsx')]:
        for key in re.findall(r"""useLocalState(?:<[^(]*>)?\(\s*[`'"](trackcal:[^`'"]+)[`'"]""", path.read_text(encoding='utf8', errors='replace')):
            keys.add(re.sub(r'\$\{[^}]+\}', 'calories' if key.startswith('trackcal:target:') else '2026-11-02', key))
    keys.add('trackcal:my-gear')   # saved through a constant (lib/my-gear.ts MY_GEAR_KEY), which the scan above can't see
    keys -= {'trackcal:camera:draft', 'trackcal:training:draft'}  # the browser never sends these
    assert len(keys) > 15
    _, headers = signup()
    refused = [key for key in sorted(keys) if client.put('/api/v1/users/workspace', headers=headers, json={'entries': {key: []}}).status_code != 200]
    assert refused == []
