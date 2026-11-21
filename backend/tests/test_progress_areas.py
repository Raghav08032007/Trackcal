"""Phase B: the Progress page's areas compare this week with last week, from the person's own data."""
from datetime import datetime, timedelta, timezone

import database
import models


def test_areas_compare_this_week_with_last_week():
    from tests.test_web_gateway import browser, signed_up
    c = browser(); email, _ = signed_up(c)
    empty = c.get('/api/personalization/progress').get_json()
    ids = [a['id'] for a in empty['areas']]
    assert ids == ['food', 'water', 'sleep', 'activity', 'workouts', 'routes', 'habits', 'weight', 'report']
    assert not any(a['used'] for a in empty['areas'])                       # a new account: nothing used yet, nothing invented

    today = datetime.fromisoformat(empty['today']).date()
    with database.SessionLocal() as db:
        user = db.query(models.User).filter_by(email=email).one()
        for back in range(14):
            day = str(today - timedelta(days=back))
            this_week = back < 7
            db.add(models.DailyWellness(user_id=user.id, day=day, water_ml=2500 if this_week else 1000, water_goal_ml=2000,
                                        sleep_hours=8 if this_week else 6, active_minutes=30 if this_week else 10))
        db.add(models.WorkoutEntry(id='11111111-1111-4111-8111-111111111111', user_id=user.id, day=str(today), name='Swim', minutes=40))
        db.add(models.MealLog(user_id=user.id, logged_at=datetime.now(timezone.utc).replace(tzinfo=None), total_calories=500, total_protein_g=20)) if hasattr(models.MealLog, 'total_calories') else None
        db.commit()
    out = {a['id']: a for a in c.get('/api/personalization/progress').get_json()['areas']}
    assert (out['water']['now'], out['water']['prev']) == (7, 0)             # goal reached every day this week, never last week
    assert (out['sleep']['now'], out['sleep']['prev']) == (8, 6) and out['sleep']['extra']['in_range_now'] == 7
    assert out['activity']['now'] == 7 * 30 + 10 and out['activity']['prev'] == 70   # today's 40 logged minutes beat the 30 on the day
    assert out['workouts']['now'] == 1 and out['workouts']['prev'] == 0
    assert len(out['water']['daily']) == 7 and out['water']['used'] and out['routes']['used'] is False


def test_progress_needs_an_account():
    from tests.test_web_gateway import browser
    assert browser().get('/api/personalization/progress').status_code == 401
