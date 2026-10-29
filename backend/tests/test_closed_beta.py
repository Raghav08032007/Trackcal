"""Phase 6: invite-only sign-up behind the `closed_beta` flag, and in-app feedback stored as support tickets."""
import uuid
from datetime import timedelta

import database, models
from services import invites
from timeutil import utcnow
from tests.client import client


def signup(code=None):
    body = {'email': f'qa-beta-{uuid.uuid4().hex}@tests.example.com', 'password': 'Synthetic-beta-123!'}
    if code is not None: body['invite_code'] = code
    return client.post('/api/v1/auth/signup', json=body)


def new_code(**kwargs):
    with database.SessionLocal() as db: return invites.create(db, kwargs.pop('label', 'qa'), **kwargs)


def test_with_the_gate_off_anyone_can_sign_up(monkeypatch):
    monkeypatch.setenv('FEATURE_CLOSED_BETA', 'false')
    assert client.get('/api/v1/auth/signup-config').json() == {'invite_required': False}
    assert signup().status_code == 201


def test_with_the_gate_on_a_valid_code_is_needed_and_each_seat_is_used_once(monkeypatch):
    monkeypatch.setenv('FEATURE_CLOSED_BETA', 'true')
    assert client.get('/api/v1/auth/signup-config').json() == {'invite_required': True}
    code = new_code(max_uses=2)
    assert signup().status_code == 403 and signup('TC-NOPE-NOPE').status_code == 403
    refused = signup('')
    assert refused.status_code == 403 and 'closed beta' in refused.json()['detail']
    assert signup(code).status_code == 201
    assert signup(code.lower().replace('-', ' ')).status_code == 201  # typed loosely: still the same code
    assert signup(code).status_code == 403  # both seats used


def test_expired_and_revoked_codes_are_refused_and_codes_are_stored_hashed(monkeypatch):
    monkeypatch.setenv('FEATURE_CLOSED_BETA', 'true')
    expired, revoked = new_code(label='old'), new_code(label='pulled')
    with database.SessionLocal() as db:
        db.get(models.InviteCode, invites.digest(expired)).expires_at = utcnow() - timedelta(minutes=1)
        db.get(models.InviteCode, invites.digest(revoked)).revoked = True
        db.commit()
        assert all(expired not in str(row.__dict__) for row in db.query(models.InviteCode).all())
    assert signup(expired).status_code == 403 and signup(revoked).status_code == 403


def test_a_refused_signup_creates_no_account(monkeypatch):
    monkeypatch.setenv('FEATURE_CLOSED_BETA', 'true')
    email = f'qa-beta-{uuid.uuid4().hex}@tests.example.com'
    assert client.post('/api/v1/auth/signup', json={'email': email, 'password': 'Synthetic-beta-123!', 'invite_code': 'TC-AAAA-BBBB'}).status_code == 403
    with database.SessionLocal() as db: assert db.query(models.User).filter_by(email=email).first() is None


def test_the_browser_signup_passes_the_code_through(monkeypatch):
    from tests.test_web_gateway import browser, post
    monkeypatch.setenv('FEATURE_CLOSED_BETA', 'true')
    code, person = new_code(), browser()
    assert person.get('/api/account/signup-config').get_json() == {'invite_required': True}
    email = f'qa-beta-{uuid.uuid4().hex}@tests.example.com'
    assert post(person, '/api/account/signup', {'email': email, 'password': 'Synthetic-beta-123!'}).status_code == 403
    assert post(person, '/api/account/signup', {'email': email, 'password': 'Synthetic-beta-123!', 'invite_code': code}).status_code == 200


def test_feedback_becomes_a_ticket_with_only_the_message_and_page():
    from tests.test_web_gateway import browser, post, signed_up
    person = browser(); signed_up(person)
    assert post(person, '/api/feedback', {'message': 'The barcode button is hard to find', 'page': '/scanner'}).status_code == 201
    assert post(person, '/api/feedback', {'message': '   '}).status_code == 400
    assert post(person, '/api/feedback', {'message': 'x'}, origin='https://evil.example').status_code == 403
    sent = post(person, '/api/feedback', {'message': 'Odd page', 'page': 'https://evil.example/x?y=1'})
    assert sent.status_code == 201
    with database.SessionLocal() as db:
        subjects = sorted(t.subject for t in db.query(models.SupportTicket).filter_by(category='beta_feedback').all())
    assert 'Beta feedback from /scanner' in subjects and 'Beta feedback from /' in subjects


def test_support_tickets_have_sane_limits():
    from tests.test_adventure import account
    _, h = account()
    assert client.post('/api/v1/support', headers=h, json={'subject': 'x' * 151, 'body': 'b'}).status_code == 422
    assert client.post('/api/v1/support', headers=h, json={'subject': 's', 'body': 'b', 'category': 'anything'}).status_code == 422
    assert client.post('/api/v1/support', headers=h, json={'subject': 's', 'body': 'b', 'category': 'bug'}).status_code == 201
