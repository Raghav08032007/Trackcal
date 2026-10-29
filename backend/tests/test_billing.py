"""Phase 5: Premium through Razorpay behind the `billing` flag. The gateway's network calls are faked; every
signature check (checkout HMAC, webhook HMAC) runs for real with test secrets."""
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta

import pytest

import database, models
from services import billing
from tests.test_coaching import account as coaching_account, slot
from tests.client import client

KEY_SECRET, WEBHOOK_SECRET = 'test-key-secret-0123456789', 'test-webhook-secret-0123456789'


class FakeGateway(billing.RazorpayGateway):
    """Real signature verification; create/cancel recorded instead of calling Razorpay."""
    def __init__(self):
        super().__init__('rzp_test_fake', KEY_SECRET); self.created, self.cancelled, self.fail = [], [], False

    def create_subscription(self, plan_id, total_count, start_at, notes):
        if self.fail: raise RuntimeError('down')
        self.created.append({'plan_id': plan_id, 'start_at': start_at, 'notes': notes, 'total_count': total_count})
        return {'id': 'sub_' + uuid.uuid4().hex[:14], 'status': 'created'}

    def cancel(self, subscription_id):
        self.cancelled.append(subscription_id); return {'id': subscription_id, 'status': 'cancelled'}


@pytest.fixture
def gateway(monkeypatch):
    monkeypatch.setenv('FEATURE_BILLING', 'true'); monkeypatch.setenv('RAZORPAY_WEBHOOK_SECRET', WEBHOOK_SECRET)
    monkeypatch.setenv('RAZORPAY_PLAN_MONTHLY', 'plan_monthly_test'); monkeypatch.setenv('RAZORPAY_PLAN_ANNUAL', 'plan_annual_test')
    fake = FakeGateway(); monkeypatch.setattr(billing, 'gateway', lambda: fake)
    return fake


def member():
    return coaching_account()


def sign(payment_id, subscription_id, secret=KEY_SECRET):
    return hmac.new(secret.encode(), f'{payment_id}|{subscription_id}'.encode(), hashlib.sha256).hexdigest()


def webhook(event, sub_id, event_id=None, payment=None, current=(None, None), secret=WEBHOOK_SECRET):
    body = {'event': event, 'payload': {'subscription': {'entity': {'id': sub_id, 'current_start': current[0], 'current_end': current[1]}}}}
    if payment: body['payload']['payment'] = {'entity': payment}
    raw = json.dumps(body).encode()
    return client.post('/api/v1/billing/webhook', content=raw, headers={'Content-Type': 'application/json', 'X-Razorpay-Signature': hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest(),
                                                                         'X-Razorpay-Event-Id': event_id or 'evt_' + uuid.uuid4().hex})


def subscribe(headers, plan='premium_monthly'):
    started = client.post('/api/v1/subscriptions/checkout', headers=headers, json={'plan': plan})
    assert started.status_code == 200, started.text
    sub_id = started.json()['subscription_id']
    done = client.post('/api/v1/subscriptions/verify', headers=headers, json={'razorpay_payment_id': 'pay_trial01', 'razorpay_subscription_id': sub_id, 'razorpay_signature': sign('pay_trial01', sub_id)})
    assert done.status_code == 200, done.text
    return sub_id, done.json()


# ── Flag off: nothing changes ───────────────────────────────────────────────

def test_with_billing_off_nothing_can_be_bought(monkeypatch):
    monkeypatch.setenv('FEATURE_BILLING', 'false')
    _, h = member()
    assert set(client.get('/api/v1/subscriptions/plans').json()['plans']) == {'free'}
    assert client.post('/api/v1/subscriptions/checkout', headers=h, json={'plan': 'premium_monthly'}).status_code == 404
    assert client.get('/api/v1/subscriptions/status', headers=h).json()['billing_enabled'] is False


# ── Entitlement rules ───────────────────────────────────────────────────────

@pytest.mark.parametrize('status,trial_end,period_end,expected', [
    ('trialing', +2, None, True), ('trialing', -1, None, False),
    ('active', None, +5, True), ('active', None, -2, True), ('active', None, -4, False),  # 3-day grace for a retrying renewal
    ('past_due', None, -1, True), ('cancelled', None, +3, True), ('cancelled', None, -1, False),
    ('expired', None, +30, False), ('free', None, +30, False)])
def test_who_counts_as_premium(status, trial_end, period_end, expected):
    now = datetime(2026, 10, 29, 12)
    day = lambda n: now + timedelta(days=n) if n is not None else None
    row = models.Subscription(plan_id='premium_monthly', status=models.SubscriptionStatus(status), trial_ends_at=day(trial_end), current_period_end=day(period_end))
    assert billing.entitled(row, now) is expected


# ── Checkout, verify, webhooks, cancel ──────────────────────────────────────

def test_plans_show_prices_what_stays_free_and_the_trial(gateway):
    plans = client.get('/api/v1/subscriptions/plans').json()
    assert plans['currency'] == 'INR' and plans['plans']['premium_monthly']['amount_paise'] == 9900 and plans['plans']['premium_annual']['amount_paise'] == 79900
    assert plans['trial_days'] == 7 and 'Camera rep counting' in plans['always_free']


def test_first_checkout_starts_a_trial_and_unlocks_premium(gateway):
    _, h = member()
    before = billing.utcnow()
    sub_id, status = subscribe(h)
    created = gateway.created[0]
    assert created['plan_id'] == 'plan_monthly_test' and timedelta(days=6, hours=23) < created['start_at'] - before < timedelta(days=7, minutes=1)
    assert status['status'] == 'trialing' and status['premium'] is True and status['ai_daily_limit'] == 100 and status['trial_available'] is False
    assert client.post('/api/v1/subscriptions/checkout', headers=h, json={'plan': 'premium_annual'}).status_code == 409


def test_a_bad_or_foreign_confirmation_never_grants_premium(gateway):
    _, h = member(); _, other = member()
    sub_id = client.post('/api/v1/subscriptions/checkout', headers=h, json={'plan': 'premium_monthly'}).json()['subscription_id']
    forged = client.post('/api/v1/subscriptions/verify', headers=h, json={'razorpay_payment_id': 'pay_x123', 'razorpay_subscription_id': sub_id, 'razorpay_signature': sign('pay_x123', sub_id, 'wrong-secret')})
    assert forged.status_code == 400
    assert client.post('/api/v1/subscriptions/verify', headers=other, json={'razorpay_payment_id': 'pay_x123', 'razorpay_subscription_id': sub_id, 'razorpay_signature': sign('pay_x123', sub_id)}).status_code == 404
    assert client.get('/api/v1/subscriptions/status', headers=h).json()['premium'] is False


def test_razorpay_being_down_charges_nothing_and_changes_nothing(gateway):
    _, h = member(); gateway.fail = True
    assert client.post('/api/v1/subscriptions/checkout', headers=h, json={'plan': 'premium_monthly'}).status_code == 502
    assert client.get('/api/v1/subscriptions/status', headers=h).json()['status'] == 'free'


def test_webhooks_need_a_valid_signature_and_apply_each_event_once(gateway):
    _, h = member(); sub_id, _ = subscribe(h)
    assert webhook('subscription.halted', sub_id, secret='forged').status_code == 400
    start, end = int(datetime(2026, 11, 5).timestamp()), int(datetime(2026, 12, 5).timestamp())
    payment = {'id': 'pay_first01', 'amount': 9900, 'currency': 'INR'}
    assert webhook('subscription.charged', sub_id, 'evt_1', payment, (start, end)).json()['status'] == 'subscription.charged'
    assert webhook('subscription.charged', sub_id, 'evt_1', payment, (start, end)).json()['status'] == 'duplicate'
    assert webhook('subscription.charged', sub_id, 'evt_2', payment, (start, end)).status_code == 200  # same payment, new event id
    history = client.get('/api/v1/subscriptions/history', headers=h).json()['payments']
    assert len(history) == 1 and history[0]['amount'] == 99 and history[0]['currency'] == 'INR'
    status = client.get('/api/v1/subscriptions/status', headers=h).json()
    assert status['status'] == 'active' and status['premium'] is True
    assert status['current_period_end'].startswith('2026-12-0')  # from Razorpay's current_end (local-midnight test timestamp)
    assert webhook('subscription.halted', sub_id).status_code == 200
    assert client.get('/api/v1/subscriptions/status', headers=h).json()['premium'] is False
    assert webhook('subscription.activated', 'sub_unknown').json()['status'] == 'ignored'


def test_cancelling_keeps_premium_until_the_paid_period_ends(gateway):
    owner, h = member(); sub_id, _ = subscribe(h)
    end = billing.utcnow() + timedelta(days=20)
    webhook('subscription.activated', sub_id, current=(int((end - timedelta(days=30)).timestamp()), int(end.timestamp())))
    cancelled = client.post('/api/v1/subscriptions/cancel', headers=h, json={'reason': ''})
    assert cancelled.status_code == 200 and gateway.cancelled == [sub_id]
    assert cancelled.json()['status'] == 'cancelled' and cancelled.json()['premium'] is True
    assert client.post('/api/v1/subscriptions/cancel', headers=h, json={}).status_code == 200 and gateway.cancelled == [sub_id]  # once
    with database.SessionLocal() as db:
        row = db.query(models.Subscription).filter_by(user_id=owner).first()
        assert billing.entitled(row, end + timedelta(minutes=1)) is False


def test_the_trial_is_offered_once_per_person(gateway):
    owner, h = member(); sub_id, _ = subscribe(h)
    webhook('subscription.cancelled', sub_id)
    with database.SessionLocal() as db:
        row = db.query(models.Subscription).filter_by(user_id=owner).first(); row.trial_ends_at = billing.utcnow() - timedelta(days=1); db.commit()
    again = client.post('/api/v1/subscriptions/checkout', headers=h, json={'plan': 'premium_annual'})
    assert again.status_code == 200 and again.json()['trial_days'] == 0 and gateway.created[-1]['start_at'] is None
    sub2 = again.json()['subscription_id']
    paid = client.post('/api/v1/subscriptions/verify', headers=h, json={'razorpay_payment_id': 'pay_paid01', 'razorpay_subscription_id': sub2, 'razorpay_signature': sign('pay_paid01', sub2)}).json()
    assert paid['status'] == 'active' and paid['premium'] is True


# ── What Premium unlocks ────────────────────────────────────────────────────

def test_premium_raises_the_daily_ai_limit(gateway):
    from types import SimpleNamespace
    owner, h = member()
    with database.SessionLocal() as db: assert billing.ai_daily_limit(db, SimpleNamespace(id=owner)) == billing.free_ai_limit()
    subscribe(h)
    with database.SessionLocal() as db: assert billing.ai_daily_limit(db, SimpleNamespace(id=owner)) == 100


def test_new_coach_slots_open_to_premium_first(gateway, monkeypatch):
    _, coach = coaching_account(True); _, free = member(); _, premium = member(); subscribe(premium)
    first, second = slot(coach), slot(coach, 2)
    assert first['premium_until'] is not None
    refused = client.post('/api/v1/coaching/bookings', headers=free, json={'slot_id': first['id']})
    assert refused.status_code == 403 and 'opens to everyone' in refused.json()['detail']
    assert client.post('/api/v1/coaching/bookings', headers=premium, json={'slot_id': first['id']}).status_code == 201
    with database.SessionLocal() as db:
        db.get(models.CoachSlot, second['id']).published_at -= timedelta(hours=25); db.commit()
    assert client.post('/api/v1/coaching/bookings', headers=free, json={'slot_id': second['id']}).status_code == 201
    monkeypatch.setenv('FEATURE_BILLING', 'false')
    third = slot(coach, 3)
    assert third['premium_until'] is None and client.post('/api/v1/coaching/bookings', headers=free, json={'slot_id': third['id']}).status_code == 201


def test_premium_accessories_and_what_happens_when_premium_ends(gateway):
    from tests.test_adventure import init
    owner, h = member(); init(h)
    body = {'character_id': 'pip', 'accessory': 'star'}  # other settings keep their defaults
    assert client.post('/api/v1/adventure/companion-settings', headers=h, json=body).status_code == 402
    sub_id, _ = subscribe(h)
    assert client.post('/api/v1/adventure/companion-settings', headers=h, json=body).json()['customization']['accessory'] == 'star'
    webhook('subscription.halted', sub_id)
    summary = client.get('/api/v1/adventure/summary', headers=h).json()
    assert summary['customization']['accessory'] == 'none' and summary['premium'] is False
    with database.SessionLocal() as db: assert db.get(models.CharacterCustomization, owner).accessory == 'star'  # kept for a comeback


def test_only_test_mode_keys_are_accepted_outside_production(monkeypatch):
    monkeypatch.setenv('APP_ENV', 'testing'); monkeypatch.setenv('RAZORPAY_KEY_ID', 'rzp_live_abc'); monkeypatch.setenv('RAZORPAY_KEY_SECRET', 'x')
    with pytest.raises(RuntimeError): billing.gateway()


def test_browser_routes(gateway):
    from tests.test_web_gateway import browser, post, signed_up
    person = browser()
    assert person.get('/api/billing/plans').get_json()['currency'] == 'INR'
    assert person.get('/api/billing/status').status_code == 401
    signed_up(person)
    started = post(person, '/api/billing/checkout', {'plan': 'premium_monthly'})
    assert started.status_code == 200 and started.get_json()['key_id'] == 'rzp_test_fake'
    assert post(person, '/api/billing/checkout', {'plan': 'premium_monthly'}, origin='https://evil.example').status_code == 403
    assert person.get('/api/billing/refund').status_code == 404


def test_the_simulated_gateway_exists_only_for_testing(monkeypatch):
    monkeypatch.setenv('RAZORPAY_SIMULATED', '1'); monkeypatch.setenv('RAZORPAY_KEY_SECRET', KEY_SECRET)
    monkeypatch.setenv('APP_ENV', 'testing')
    sim = billing.gateway()
    assert sim.key_id == 'rzp_test_simulated' and sim.verify_checkout('pay_1', 'sub_1', sign('pay_1', 'sub_1')) and not sim.verify_checkout('pay_1', 'sub_1', 'x' * 64)
    for env in ('production', 'development'):
        monkeypatch.setenv('APP_ENV', env)
        with pytest.raises(RuntimeError): billing.gateway()
