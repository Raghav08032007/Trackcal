"""The Coach plan: Premium plus room for 50 clients on the trainer dashboard. Free verified coaches keep 3; without
billing there is no limit to pay for; only coach accounts can buy it; Premium members cancel Premium first."""
import pytest

from tests.client import client
from tests.test_billing import gateway, subscribe  # noqa: F401  (gateway is a fixture)
from tests.test_coach_clients import CC, coach, invite, join
from tests.test_wellness import account


@pytest.fixture
def coach_plans(gateway, monkeypatch):  # noqa: F811
    monkeypatch.setenv('FEATURE_ORGANIZER_SAAS', 'true')
    monkeypatch.setenv('RAZORPAY_PLAN_COACH_MONTHLY', 'plan_coach_monthly_test'); monkeypatch.setenv('RAZORPAY_PLAN_COACH_ANNUAL', 'plan_coach_annual_test')
    return gateway


def limit(h):
    return client.get(CC, headers=h).json()['max_clients']


def test_the_plans_list_the_coach_plan(coach_plans):
    plans = client.get('/api/v1/subscriptions/plans', headers=account()[1]).json()['plans']
    assert plans['coach_monthly']['name'] == 'Coach' and plans['coach_monthly']['amount_paise'] == 49900 and plans['premium_monthly']['name'] == 'Premium'


def test_a_free_coach_has_three_places_and_the_fourth_client_waits(coach_plans):
    _, ch = coach()
    assert limit(ch) == 3
    for _ in range(3): assert join(account()[1], invite(ch), diary=True).status_code == 201
    r = join(account()[1], invite(ch), diary=True)
    assert r.status_code == 409 and 'no room' in r.json()['detail']


def test_the_coach_plan_opens_fifty_places_and_includes_premium(coach_plans):
    _, ch = coach()
    _, status = subscribe(ch, 'coach_monthly')
    assert coach_plans.created[-1]['plan_id'] == 'plan_coach_monthly_test'
    assert status['premium'] is True and status['coach'] is True and status['ai_daily_limit'] == 100
    assert limit(ch) == 50


def test_only_coach_accounts_can_buy_it(coach_plans):
    _, h = account()
    r = client.post('/api/v1/subscriptions/checkout', headers=h, json={'plan': 'coach_monthly'})
    assert r.status_code == 403 and 'coach accounts' in r.json()['detail']


def test_a_premium_coach_is_told_to_cancel_premium_first(coach_plans):
    _, ch = coach()
    subscribe(ch, 'premium_monthly')
    r = client.post('/api/v1/subscriptions/checkout', headers=ch, json={'plan': 'coach_annual'})
    assert r.status_code == 409 and 'Cancel Premium first' in r.json()['detail']
    assert limit(ch) == 3                                  # Premium alone does not add client places


def test_without_billing_coaches_are_not_limited(monkeypatch):
    monkeypatch.setenv('FEATURE_ORGANIZER_SAAS', 'true'); monkeypatch.setenv('FEATURE_BILLING', 'false')
    _, ch = coach()
    assert limit(ch) == 50
