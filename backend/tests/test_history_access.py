"""D4: free accounts see 7 days in detail plus monthly summaries of everything; Premium sees all detail; nothing is ever deleted;
and while Premium can't be bought (billing off), everyone sees everything."""
import uuid
from datetime import date, datetime, timedelta

import database
import models
from services.history_access import monthly
from tests.test_web_gateway import browser, signed_up


def test_monthly_summaries_add_up():
    days = [{'day': '2026-10-01', 'meals': 2, 'kcal': 1800, 'water_ml': 2000, 'sleep_hours': 7, 'active_min': 30, 'workouts': 1, 'weight_kg': 70.0},
            {'day': '2026-10-15', 'meals': 3, 'kcal': 2200, 'water_ml': 1000, 'sleep_hours': 8, 'active_min': 0, 'workouts': 0, 'weight_kg': 69.2},
            {'day': '2026-10-20'},                                                     # nothing logged: not counted
            {'day': '2026-11-02', 'meals': 0, 'water_ml': 1500, 'active_min': 20, 'workouts': 1}]
    nov, oct_ = monthly(days)
    assert oct_ == {'month': '2026-10', 'days_logged': 2, 'meals': 5, 'avg_kcal': 2000, 'avg_water_ml': 1500, 'avg_sleep_h': 7.5, 'active_min': 30,
                    'workouts': 1, 'weight_start': 70.0, 'weight_end': 69.2}
    assert nov['month'] == '2026-11' and nov['avg_kcal'] is None and nov['days_logged'] == 1


def account_with_old_history():
    c = browser(); email, _ = signed_up(c)
    with database.SessionLocal() as db:
        user = db.query(models.User).filter_by(email=email).one()
        old, recent = date.today() - timedelta(days=20), date.today() - timedelta(days=2)
        for d in (old, recent):
            db.add(models.DailyWellness(user_id=user.id, day=str(d), water_ml=1800, sleep_hours=7.5))
            db.add(models.MealLog(user_id=user.id, logged_at=datetime.combine(d, datetime.min.time()) + timedelta(hours=13), meal_type='lunch', total_calories=650))
            db.add(models.WorkoutEntry(id=str(uuid.uuid4()), user_id=user.id, day=str(d), name='Brisk walk', minutes=30, source='Manual entry'))
        db.commit()
        return c, user.id, old, recent


def detail(c, old, recent):
    return {'old_diary': c.get(f'/api/wellness/diary?day={old}').status_code, 'recent_diary': c.get(f'/api/wellness/diary?day={recent}').status_code,
            'old_day': c.get(f'/api/personalization/days/{old}').status_code,
            'days': len(c.get('/api/personalization/days').get_json()['days']),
            'workouts': [i['day'] for i in c.get('/api/wellness/history').get_json()['items']],
            'months': sum(m['days_logged'] for m in c.get('/api/personalization/history-summary').get_json()['months'])}


def test_while_premium_cannot_be_bought_everyone_sees_everything(monkeypatch):
    monkeypatch.setenv('FEATURE_BILLING', 'false')
    c, _, old, recent = account_with_old_history()
    out = detail(c, old, recent)
    assert out['old_diary'] == 200 and out['old_day'] == 200 and str(old) in out['workouts'] and out['days'] == 35


def test_free_accounts_see_a_week_in_detail_and_every_month_in_summary(monkeypatch):
    monkeypatch.setenv('FEATURE_BILLING', 'true')
    c, _, old, recent = account_with_old_history()
    out = detail(c, old, recent)
    assert out['recent_diary'] == 200 and out['old_diary'] == 402 and out['old_day'] == 402
    assert out['days'] == 7 and str(old) not in out['workouts'] and str(recent) in out['workouts']
    assert out['months'] == 2                                                    # both days still counted in the monthly summary
    refused = c.get(f'/api/wellness/diary?day={old}').get_json()
    assert 'Nothing has been deleted' in (refused.get('error') or refused.get('detail', ''))


def test_premium_sees_all_detail_and_nothing_was_ever_deleted(monkeypatch):
    monkeypatch.setenv('FEATURE_BILLING', 'true')
    c, user_id, old, recent = account_with_old_history()
    assert detail(c, old, recent)['old_diary'] == 402
    with database.SessionLocal() as db:
        row = db.query(models.Subscription).filter_by(user_id=user_id).first() or models.Subscription(user_id=user_id)
        row.plan_id, row.status, row.current_period_end = 'premium_monthly', models.SubscriptionStatus.active, datetime.utcnow() + timedelta(days=20)
        db.add(row)
        db.commit()
    out = detail(c, old, recent)
    assert out['old_diary'] == 200 and out['old_day'] == 200 and str(old) in out['workouts'] and out['days'] == 35


def test_a_walk_logged_as_active_minutes_and_as_a_workout_counts_once(monkeypatch):
    monkeypatch.setenv('FEATURE_BILLING', 'false')
    c, user_id, old, recent = account_with_old_history()
    with database.SessionLocal() as db:
        row = db.query(models.DailyWellness).filter_by(user_id=user_id, day=str(recent)).one(); row.active_minutes = 25; db.commit()
    months = c.get('/api/personalization/history-summary').get_json()['months']
    assert sum(m['active_min'] for m in months) == 30 + 30                      # max(25, 30) on the recent day, 30 on the old one
