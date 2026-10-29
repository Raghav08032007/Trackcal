"""Phase 6: the retention policy removes old operational records and never touches personal records."""
import uuid
from datetime import timedelta

import database, models
from services import retention
from timeutil import utcnow
from tests.test_adventure import account


def test_old_operational_records_go_and_recent_or_personal_ones_stay():
    owner, _ = account(); now = utcnow()
    with database.SessionLocal() as db:
        db.add_all([
            models.BarcodeCache(barcode='90000000000001', found=False, fetched_at=now - timedelta(days=2), expires_at=now - timedelta(days=1)),
            models.BarcodeCache(barcode='90000000000002', found=False, fetched_at=now, expires_at=now + timedelta(days=1)),
            models.ScheduledNotification(user_id=owner, type='daily_plan', local_day='2026-01-01', scheduled_for_utc=now - timedelta(days=91), idempotency_key=f'{uuid.uuid4()}', status='sent'),
            models.ScheduledNotification(user_id=owner, type='daily_plan', local_day='2026-10-01', scheduled_for_utc=now - timedelta(days=10), idempotency_key=f'{uuid.uuid4()}', status='sent'),
            models.ScheduledNotification(user_id=owner, type='daily_plan', local_day='2026-01-02', scheduled_for_utc=now - timedelta(days=95), idempotency_key=f'{uuid.uuid4()}', status='pending'),
            models.NotificationEvent(kind='sent', created_at=now - timedelta(days=401)), models.NotificationEvent(kind='sent', created_at=now),
            models.FoodSearchHistory(user_id=owner, query='old ragi', updated_at=now - timedelta(days=181)), models.FoodSearchHistory(user_id=owner, query='new ragi', updated_at=now),
            models.MealLog(user_id=owner, logged_at=now - timedelta(days=900), meal_type=models.MealType.lunch),
        ]); db.commit()
        counts = retention.apply(db, now)
        assert counts['barcode_cache'] >= 1 and counts['scheduled_notifications'] >= 1 and counts['notification_events'] >= 1 and counts['food_search_history'] >= 1
        assert db.get(models.BarcodeCache, '90000000000002') is not None and db.get(models.BarcodeCache, '90000000000001') is None
        kept = db.query(models.ScheduledNotification).filter_by(user_id=owner).all()
        assert sorted(r.local_day for r in kept) == ['2026-01-02', '2026-10-01']  # recent, and unfinished ones, stay
        assert [r.query for r in db.query(models.FoodSearchHistory).filter_by(user_id=owner)] == ['new ragi']
        assert db.query(models.MealLog).filter_by(user_id=owner).count() == 1  # personal records untouched
