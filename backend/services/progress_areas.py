"""Every area the person tracks, this week against last week: food, water, sleep, activity, workouts (camera, gym,
logged), routes, habits, weight and the blood report. Numbers and codes only; the app writes the words (and picks a
suggestion), so they can be translated. Weeks are the last 7 days including today and the 7 days before that, in the
person's own time zone."""
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import models


def _days(end: date, n: int):
    return [str(end - timedelta(days=n - 1 - i)) for i in range(n)]


def _week_split(series):
    """(this week, last week) halves of a 14-day list."""
    return series[7:], series[:7]


def collect(db, user, tz_name: str, today: date, targets: dict, water_goal_default: int, goal: str | None):
    tz = ZoneInfo(tz_name)
    days = _days(today, 14)
    first, last = days[0], days[-1]
    wellness = {r.day: r for r in db.query(models.DailyWellness).filter(models.DailyWellness.user_id == user.id,
                                                                        models.DailyWellness.day >= first, models.DailyWellness.day <= last).all()}
    # meals are stored in UTC; count them on the person's own day
    since = datetime.combine(date.fromisoformat(first) - timedelta(days=1), datetime.min.time())
    food = {}
    for m in db.query(models.MealLog).filter(models.MealLog.user_id == user.id, models.MealLog.is_deleted.is_(False), models.MealLog.logged_at >= since).all():
        d = str(m.logged_at.replace(tzinfo=timezone.utc).astimezone(tz).date())
        f = food.setdefault(d, {'meals': 0, 'kcal': 0.0, 'protein': 0.0})
        f['meals'] += 1; f['kcal'] += m.total_calories or 0; f['protein'] += m.total_protein_g or 0
    logged_min = {}
    manual = {}
    for w in db.query(models.WorkoutEntry).filter(models.WorkoutEntry.user_id == user.id, models.WorkoutEntry.is_deleted.is_(False),
                                                  models.WorkoutEntry.day >= first, models.WorkoutEntry.day <= last).all():
        logged_min[w.day] = logged_min.get(w.day, 0) + (w.minutes or 0)
        manual[w.day] = manual.get(w.day, 0) + 1
    camera, gym = {}, {}
    for s in db.query(models.WorkoutSession).filter(models.WorkoutSession.user_id == user.id, models.WorkoutSession.is_deleted.is_(False),
                                                    models.WorkoutSession.status == 'completed', models.WorkoutSession.completed_at >= since).all():
        d = str(s.completed_at.replace(tzinfo=timezone.utc).astimezone(tz).date())
        bucket = camera if (s.details or {}).get('tracking_method') == 'camera' else gym
        bucket[d] = bucket.get(d, 0) + 1
    routes, route_km = {}, {}
    for a in db.query(models.Activity).filter(models.Activity.user_id == user.id, models.Activity.started_at >= since).all():
        if getattr(a, 'is_deleted', False):
            continue
        d = str(a.started_at.replace(tzinfo=timezone.utc).astimezone(tz).date())
        routes[d] = routes.get(d, 0) + 1
        route_km[d] = route_km.get(d, 0.0) + (a.distance_m or 0) / 1000
    task_days = {r[0] for r in db.query(models.DailyTaskMark.day).filter(models.DailyTaskMark.user_id == user.id,
                                                                         models.DailyTaskMark.day >= first, models.DailyTaskMark.day <= last).all()}

    kcal_target, protein_target = targets.get('calories'), targets.get('protein')
    series = []
    for d in days:
        r, f = wellness.get(d), food.get(d, {'meals': 0, 'kcal': 0.0, 'protein': 0.0})
        water_goal = (r.water_goal_ml if r and r.water_goal_ml else water_goal_default)
        series.append({'day': d, 'meals': f['meals'], 'kcal': round(f['kcal']), 'protein': round(f['protein'], 1),
                       'on_target': bool(f['meals'] >= 2 and kcal_target and abs(f['kcal'] - kcal_target) <= 0.1 * kcal_target),
                       'water_ml': r.water_ml if r else 0, 'water_goal_ml': water_goal,
                       'sleep_hours': r.sleep_hours if r else None,
                       'active_min': max(r.active_minutes if r else 0, logged_min.get(d, 0)),
                       'camera': camera.get(d, 0), 'gym': gym.get(d, 0), 'manual': manual.get(d, 0),
                       'routes': routes.get(d, 0), 'route_km': round(route_km.get(d, 0.0), 2),
                       'task_day': d in task_days, 'weight_kg': r.weight_kg if r and r.weight_kg else None})
    now, prev = _week_split(series)

    def total(rows, key):
        return round(sum((x[key] or 0) for x in rows), 2)

    def count(rows, test):
        return sum(1 for x in rows if test(x))

    def avg_sleep(rows):
        nights = [x['sleep_hours'] for x in rows if x['sleep_hours']]
        return (round(sum(nights) / len(nights), 1) if nights else None), len(nights)

    sleep_now, nights_now = avg_sleep(now)
    sleep_prev, nights_prev = avg_sleep(prev)
    weights = [(x['day'], x['weight_kg']) for x in series if x['weight_kg']]
    report = db.query(models.LabReport).filter_by(user_id=user.id).order_by(models.LabReport.report_date.desc(), models.LabReport.created_at.desc()).first()
    report_tests = db.query(models.LabResult).filter_by(report_id=report.id).count() if report and hasattr(models, 'LabResult') else None
    protein_days = lambda rows: count(rows, lambda x: x['meals'] and protein_target and x['protein'] >= 0.9 * protein_target)

    areas = [
        {'id': 'food', 'now': count(now, lambda x: x['meals'] > 0), 'prev': count(prev, lambda x: x['meals'] > 0), 'of': 7, 'higher_is_better': True,
         'extra': {'on_target_now': count(now, lambda x: x['on_target']), 'on_target_prev': count(prev, lambda x: x['on_target']),
                   'protein_days_now': protein_days(now), 'protein_days_prev': protein_days(prev),
                   'kcal_target': kcal_target, 'protein_target': protein_target},
         'daily': [x['meals'] for x in now]},
        {'id': 'water', 'now': count(now, lambda x: x['water_goal_ml'] and x['water_ml'] >= x['water_goal_ml']),
         'prev': count(prev, lambda x: x['water_goal_ml'] and x['water_ml'] >= x['water_goal_ml']), 'of': 7, 'higher_is_better': True,
         'extra': {'avg_ml_now': round(total(now, 'water_ml') / 7), 'avg_ml_prev': round(total(prev, 'water_ml') / 7), 'goal_ml': now[-1]['water_goal_ml']},
         'daily': [x['water_ml'] for x in now]},
        {'id': 'sleep', 'now': sleep_now, 'prev': sleep_prev, 'of': None, 'higher_is_better': None,
         'extra': {'nights_now': nights_now, 'nights_prev': nights_prev,
                   'in_range_now': count(now, lambda x: x['sleep_hours'] and 7 <= x['sleep_hours'] <= 9),
                   'in_range_prev': count(prev, lambda x: x['sleep_hours'] and 7 <= x['sleep_hours'] <= 9)},
         'daily': [x['sleep_hours'] or 0 for x in now]},
        {'id': 'activity', 'now': total(now, 'active_min'), 'prev': total(prev, 'active_min'), 'of': 150, 'higher_is_better': True,
         'daily': [x['active_min'] for x in now]},
        {'id': 'workouts', 'now': total(now, 'camera') + total(now, 'gym') + total(now, 'manual'),
         'prev': total(prev, 'camera') + total(prev, 'gym') + total(prev, 'manual'), 'of': None, 'higher_is_better': True,
         'extra': {'camera_now': total(now, 'camera'), 'camera_prev': total(prev, 'camera'), 'gym_now': total(now, 'gym'), 'manual_now': total(now, 'manual')},
         'daily': [x['camera'] + x['gym'] + x['manual'] for x in now]},
        {'id': 'routes', 'now': total(now, 'route_km'), 'prev': total(prev, 'route_km'), 'of': None, 'higher_is_better': True,
         'extra': {'count_now': total(now, 'routes'), 'count_prev': total(prev, 'routes')},
         'daily': [x['route_km'] for x in now]},
        {'id': 'habits', 'now': count(now, lambda x: x['task_day']), 'prev': count(prev, lambda x: x['task_day']), 'of': 7, 'higher_is_better': True,
         'daily': [1 if x['task_day'] else 0 for x in now]},
        {'id': 'weight', 'now': weights[-1][1] if weights else None, 'prev': weights[0][1] if len(weights) > 1 else None, 'of': None,
         'higher_is_better': (True if goal == 'gain_muscle' else False if goal == 'lose' else None),
         'extra': {'readings': len(weights), 'since': weights[0][0] if len(weights) > 1 else None, 'goal': goal}, 'daily': []},
        {'id': 'report', 'now': report.report_date if report else None, 'prev': None, 'of': None, 'higher_is_better': None,
         'extra': {'days_since': (today - date.fromisoformat(report.report_date)).days if report else None, 'tests': report_tests}, 'daily': []},
    ]
    for a in areas:
        a['used'] = _used(a)
    return {'today': str(today), 'week_start': days[7], 'previous_start': days[0], 'areas': areas}


def _used(area):
    """Whether the person has used this area in the last two weeks (unused areas are shown smaller, as a start)."""
    if area['id'] == 'report':
        return area['now'] is not None
    if area['id'] == 'weight':
        return area['now'] is not None
    if area['id'] == 'sleep':
        return bool(area['extra']['nights_now'] or area['extra']['nights_prev'])
    return bool(area['now'] or area['prev'])
