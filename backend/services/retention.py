"""Data retention: how long operational records are kept. Run daily by scripts/maintain_security.py.

Personal records (meals, workouts, accounts) are not touched here; account erasure has its own job
(services/account_erasure.py). Billing webhook records are kept for audit (they hold no personal data)."""
from datetime import timedelta

import models
from timeutil import utcnow

POLICY = {
    'account_action_tokens': 'removed once expired',
    'rate_buckets': 'removed once expired',
    'barcode_cache': 'removed once expired (30 days found, 24 hours not found)',
    'scheduled_notifications': 'finished jobs removed after 90 days',
    'notification_events': 'removed after 400 days (counts only, no user ids)',
    'food_search_history': 'searches older than 180 days removed (only the last 8 are ever shown)',
}


def apply(db, now=None):
    now = now or utcnow(); counts = {}
    delete = lambda name, query: counts.__setitem__(name, query.delete(synchronize_session=False))
    delete('account_action_tokens', db.query(models.AccountActionToken).filter(models.AccountActionToken.expires_at < now))
    delete('rate_buckets', db.query(models.RateBucket).filter(models.RateBucket.expires_at < now))
    delete('barcode_cache', db.query(models.BarcodeCache).filter(models.BarcodeCache.expires_at < now))
    delete('scheduled_notifications', db.query(models.ScheduledNotification).filter(models.ScheduledNotification.status.in_(('sent', 'skipped', 'failed')), models.ScheduledNotification.scheduled_for_utc < now - timedelta(days=90)))
    delete('notification_events', db.query(models.NotificationEvent).filter(models.NotificationEvent.created_at < now - timedelta(days=400)))
    delete('food_search_history', db.query(models.FoodSearchHistory).filter(models.FoodSearchHistory.updated_at < now - timedelta(days=180)))
    db.commit()
    return counts
