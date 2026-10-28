"""KI-04: per-IP login/signup limits in production, and X-Forwarded-For trusted only for configured hops."""
import uuid

import pytest

from routers import auth
from tests.client import app


@pytest.fixture
def production(monkeypatch):
    monkeypatch.setenv('APP_ENV', 'production')  # production_limit() reads this per call; the app is already built
    monkeypatch.delenv('SMTP_HOST', raising=False)  # signup must never reach a real mail server from a test


def login(ip, email):
    return app.test_client().post('/api/v1/auth/login', data={'username': email, 'password': 'Wrong-password-123'}, environ_base={'REMOTE_ADDR': ip})


def test_one_address_cannot_try_unlimited_accounts(production):
    ip = f'203.0.113.{uuid.uuid4().int % 250 + 1}'
    statuses = [login(ip, f'qa-ip-{uuid.uuid4().hex}@tests.example.com').status_code for _ in range(auth.LOGIN_PER_IP + 1)]
    assert statuses[:-1] == [401] * auth.LOGIN_PER_IP and statuses[-1] == 429
    # A different address (another user on another network) is unaffected.
    assert login('198.51.100.20', f'qa-ip-{uuid.uuid4().hex}@tests.example.com').status_code == 401


def test_signup_is_limited_per_address(production):
    ip = f'192.0.2.{uuid.uuid4().int % 250 + 1}'
    client = app.test_client()
    statuses = [client.post('/api/v1/auth/signup', json={'email': f'qa-ip-{uuid.uuid4().hex}@tests.example.com', 'password': 'Synthetic-ip-test-123!'}, environ_base={'REMOTE_ADDR': ip}).status_code for _ in range(auth.SIGNUP_PER_IP + 1)]
    assert statuses[:-1] == [201] * auth.SIGNUP_PER_IP and statuses[-1] == 429


def test_forwarded_for_is_ignored_unless_a_proxy_is_trusted(monkeypatch):
    from flask_app import create_app
    from flask_app.params import Request
    seen = {}

    def capture(request: Request):
        seen['ip'] = request.client.host
        return {}

    for hops, expected in ((0, '10.0.0.5'), (1, '198.51.100.9')):
        monkeypatch.setenv('TRUSTED_PROXY_HOPS', str(hops))
        local = create_app()
        from flask import Blueprint
        from flask_app import route
        bp = Blueprint(f'ip_probe_{hops}', __name__); route(bp, 'GET', f'/t/ip/{hops}', capture); local.register_blueprint(bp)
        # A client-forged first entry must never win: the proxy appends the real address last.
        local.test_client().get(f'/t/ip/{hops}', headers={'X-Forwarded-For': '6.6.6.6, 198.51.100.9'}, environ_base={'REMOTE_ADDR': '10.0.0.5'})
        assert seen['ip'] == expected


def test_invalid_proxy_hop_settings_stop_start_up(monkeypatch):
    from flask_app import create_app
    for bad in ('-1', '4', 'one'):
        monkeypatch.setenv('TRUSTED_PROXY_HOPS', bad)
        with pytest.raises(RuntimeError): create_app()
