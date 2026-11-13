"""Premium subscriptions through Razorpay (Phase 5, behind the `billing` flag).

The server is the only authority on what someone can use: `entitlements()` reads the subscription row, and every
gate (AI daily limit, priority coach booking, Premium accessories) asks it. The browser never decides.

Lifecycle (Razorpay Subscriptions):
  checkout  → we create a Razorpay subscription (start_at = now + 7 days for a first trial) and the browser opens
              Razorpay Checkout to authorise the mandate.
  verify    → the browser sends back payment id + subscription id + signature; we check the HMAC with our secret.
  webhooks  → authenticated / activated / charged / pending / halted / cancelled / completed keep the row current.
              Each event id is stored once (billing_events), so retries and duplicates change nothing.
  cancel    → at the end of the paid period (or trial); access continues until then.
Wellness rule: logging, barcode, camera counting and reminders are never paywalled.
"""
import hmac
import hashlib
import os
from datetime import datetime, timedelta, timezone

import models
from services.feature_flags import is_enabled

TRIAL_DAYS, GRACE_DAYS, PRIORITY_HOURS = 7, 3, 24
PLANS = {
    'premium_monthly': {'label': '₹99 a month', 'amount_paise': 9900, 'period': 'monthly', 'days': 30, 'total_count': 120, 'env': 'RAZORPAY_PLAN_MONTHLY'},
    'premium_annual': {'label': '₹799 a year', 'amount_paise': 79900, 'period': 'yearly', 'days': 365, 'total_count': 10, 'env': 'RAZORPAY_PLAN_ANNUAL'},
}
PREMIUM_ACCESSORIES = ('star', 'heart', 'sparkle')
FEATURES = ['Your full history in detail, however old (free keeps the last 7 days in detail plus monthly summaries)', 'More AI estimates (100 a day instead of 15)', 'Book new coach slots 24 hours before everyone else', 'Premium companion accessories']


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def free_ai_limit():
    return int(os.getenv('DAILY_AI_LIMIT', '15'))


def subscription(db, user_id, lock=False):
    query = db.query(models.Subscription).filter_by(user_id=str(user_id))
    return (query.with_for_update() if lock else query).first()


def entitled(row, now=None):
    """Premium while trialing, paid up (plus a short grace if a renewal is retrying), or cancelled but still inside
    the period already paid for."""
    if not row or row.plan_id not in PLANS: return False
    now, status = now or utcnow(), row.status.value if row.status else 'free'
    end = row.current_period_end or row.trial_ends_at
    if status == 'trialing': return bool(row.trial_ends_at and now < row.trial_ends_at)
    if status in ('active', 'past_due'): return bool(end and now < end + timedelta(days=GRACE_DAYS))
    if status == 'cancelled': return bool(end and now < end)
    return False


def entitlements(db, user, now=None):
    on = is_enabled(db, 'billing')
    premium = on and entitled(subscription(db, user.id), now)
    return {'premium': premium, 'ai_daily_limit': int(os.getenv('PREMIUM_DAILY_AI_LIMIT', '100')) if premium else free_ai_limit(),
            'priority_booking': premium, 'premium_accessories': list(PREMIUM_ACCESSORIES) if premium else []}


def ai_daily_limit(db, user):
    return entitlements(db, user)['ai_daily_limit']


def apply_entity(row, entity, now=None):
    """Copy Razorpay's subscription state onto our row (unix timestamps → naive UTC)."""
    stamp = lambda key: datetime.fromtimestamp(entity[key], timezone.utc).replace(tzinfo=None) if entity.get(key) else None
    if stamp('current_start'): row.current_period_start = stamp('current_start')
    if stamp('current_end'): row.current_period_end = stamp('current_end')


STATUS_FOR_EVENT = {'subscription.activated': 'active', 'subscription.charged': 'active', 'subscription.resumed': 'active',
                    'subscription.pending': 'past_due', 'subscription.halted': 'expired', 'subscription.completed': 'expired',
                    'subscription.cancelled': 'cancelled', 'subscription.paused': 'expired'}


def handle_event(db, event_id, body, now=None):
    """Apply one verified webhook. Returns what happened (for logs and tests). Idempotent per event id."""
    now = now or utcnow()
    if db.query(models.BillingEvent).filter_by(provider_event_id=event_id).first(): return 'duplicate'
    kind = body.get('event', '')
    db.add(models.BillingEvent(provider_event_id=event_id, event=kind[:60], received_at=now))
    entity = ((body.get('payload') or {}).get('subscription') or {}).get('entity') or {}
    row = db.query(models.Subscription).filter_by(external_subscription_id=entity.get('id')).with_for_update().first() if entity.get('id') else None
    if not row: db.commit(); return 'ignored'
    if kind == 'subscription.authenticated':
        if row.trial_ends_at and now < row.trial_ends_at: row.status = models.SubscriptionStatus.trialing
    elif kind in STATUS_FOR_EVENT:
        row.status = models.SubscriptionStatus(STATUS_FOR_EVENT[kind]); apply_entity(row, entity)
        if kind == 'subscription.cancelled' and not row.cancelled_at: row.cancelled_at = now
    if kind == 'subscription.charged':
        payment = ((body.get('payload') or {}).get('payment') or {}).get('entity') or {}
        if payment.get('id') and not db.query(models.Payment).filter_by(external_payment_id=payment['id']).first():
            db.add(models.Payment(subscription_id=row.id, amount_cents=int(payment.get('amount') or 0), currency=(payment.get('currency') or 'INR')[:3],
                                  status='succeeded', provider='razorpay', external_payment_id=payment['id']))
    db.commit()
    return kind or 'unknown'


def verify_webhook(body: bytes, signature: str) -> bool:
    secret = os.getenv('RAZORPAY_WEBHOOK_SECRET', '')
    if not secret or not signature: return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


class RazorpayGateway:
    """The only code that talks to Razorpay. Tests replace create/cancel; signature checks always run for real."""
    def __init__(self, key_id, key_secret):
        import razorpay
        self.key_id, self.key_secret = key_id, key_secret
        self.client = razorpay.Client(auth=(key_id, key_secret))

    def create_subscription(self, plan_id, total_count, start_at, notes):
        data = {'plan_id': plan_id, 'total_count': total_count, 'customer_notify': 1, 'notes': notes}
        if start_at: data['start_at'] = int(start_at.replace(tzinfo=timezone.utc).timestamp())
        return self.client.subscription.create(data)

    def cancel(self, subscription_id):
        return self.client.subscription.cancel(subscription_id, {'cancel_at_cycle_end': 1})

    def verify_checkout(self, payment_id, subscription_id, signature) -> bool:
        expected = hmac.new(self.key_secret.encode(), f'{payment_id}|{subscription_id}'.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or '')


class SimulatedGateway(RazorpayGateway):
    """Browser journeys only (APP_ENV=testing and RAZORPAY_SIMULATED=1): no network, real signature checks."""
    def __init__(self, key_secret):
        self.key_id, self.key_secret, self.client = 'rzp_test_simulated', key_secret, None

    def create_subscription(self, plan_id, total_count, start_at, notes):
        import uuid
        return {'id': 'sub_sim' + uuid.uuid4().hex[:11], 'status': 'created'}

    def cancel(self, subscription_id):
        return {'id': subscription_id, 'status': 'cancelled'}


def gateway():
    key_id, key_secret = os.getenv('RAZORPAY_KEY_ID', ''), os.getenv('RAZORPAY_KEY_SECRET', '')
    if os.getenv('RAZORPAY_SIMULATED') == '1':
        if os.getenv('APP_ENV') != 'testing' or not key_secret: raise RuntimeError('RAZORPAY_SIMULATED is only for APP_ENV=testing with a test secret.')
        return SimulatedGateway(key_secret)
    if not key_id or not key_secret: return None
    if os.getenv('APP_ENV') != 'production' and not key_id.startswith('rzp_test_'):
        raise RuntimeError('Only Razorpay Test Mode keys (rzp_test_…) are allowed outside production.')
    return RazorpayGateway(key_id, key_secret)
