"""Today's three tasks, the streak they build and the Health Score, from the person's own data (services/daily_tasks.py)."""
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends
from routers.auth import get_current_active_user
from routers.personalization import checkins_by_part, latest_weight, local_now, prefs_for, targets as targets_view
from services import daily_tasks, gamification
from services import personalization as rules
from services.abuse_limits import consume
from services.i18n import tr


class TaskDone(BaseModel):
    task: Literal['walk', 'move']
    done: bool = True


def week_inputs(db, user, prefs, today):
    """The last 7 days of the person's own data, oldest first: water, sleep, active minutes, meals, calories and protein."""
    from services import wellness_days as wd
    start = today - timedelta(days=6)
    days = [str(start + timedelta(days=i)) for i in range(7)]
    goal_default = wd.water_goal(latest_weight(db, user))
    rows = {r.day: r for r in db.query(models.DailyWellness).filter(models.DailyWellness.user_id == user.id,
                                                                     models.DailyWellness.day >= days[0], models.DailyWellness.day <= days[-1]).all()}
    minutes = {}
    workouts = db.query(models.WorkoutEntry).filter(models.WorkoutEntry.user_id == user.id, models.WorkoutEntry.is_deleted.is_(False),
                                                    models.WorkoutEntry.day >= days[0], models.WorkoutEntry.day <= days[-1]).all()
    for w in workouts:
        minutes[w.day] = minutes.get(w.day, 0) + (w.minutes or 0)
    tz, food = ZoneInfo(prefs.timezone), {}
    since = datetime.combine(start - timedelta(days=1), datetime.min.time())
    meals = db.query(models.MealLog).filter(models.MealLog.user_id == user.id, models.MealLog.is_deleted.is_(False), models.MealLog.logged_at >= since).all()
    for m in meals:
        day = str(m.logged_at.replace(tzinfo=timezone.utc).astimezone(tz).date())   # meals are stored in UTC; the day is the person's own
        f = food.setdefault(day, {'meals': 0, 'kcal': 0.0, 'protein': 0.0})
        f['meals'] += 1
        f['kcal'] += m.total_calories or 0
        f['protein'] += m.total_protein_g or 0
    out = []
    for d in days:
        r = rows.get(d)
        out.append({'day': d, 'water_ml': r.water_ml if r else 0, 'water_goal_ml': (r.water_goal_ml if r and r.water_goal_ml else goal_default),
                    'sleep_hours': r.sleep_hours if r else None, 'active_min': max(r.active_minutes if r else 0, minutes.get(d, 0)),
                    **food.get(d, {'meals': 0, 'kcal': 0, 'protein': 0})})
    return out


def injuries(db, user, prefs, today):
    """Names of the parts still recovering, and whether every one has been checked in today."""
    from services.recovery import evaluate
    names, checked, by_part = [], True, checkins_by_part(db, user)
    for c in prefs.conditions:
        e = evaluate(c, by_part.get(c.part, []), today)
        if e['stage'] != 'recovered' or e['base'] != 'recovered':
            names.append((e['side'] + ' ' if e['side'] else '') + e['label'])
            checked = checked and e['checked_today']
    return names, checked


def planned_today(db, user, day):
    plan = db.query(models.ActivityPlan).filter(models.ActivityPlan.user_id == user.id, models.ActivityPlan.status == 'active') \
        .order_by(models.ActivityPlan.created_at.desc()).first()
    if not plan:
        return None
    a = db.query(models.PlanActivity).filter(models.PlanActivity.plan_id == plan.id, models.PlanActivity.scheduled_day == day,
                                             models.PlanActivity.template_id != 'recovery').first()
    return {'name': rules.TEMPLATES.get(a.template_id, {}).get('name', 'Planned session'), 'minutes': a.minutes, 'done': a.status == 'completed'} if a else None


def today_view(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    from routers.health import latest_assessment
    prefs = prefs_for(db.get(models.PersonalizationProfile, user.id))
    today = local_now(prefs).date()
    day = str(today)
    week = week_inputs(db, user, prefs, today)
    now = week[-1]
    injured, checked = injuries(db, user, prefs, today)
    report = latest_assessment(db, user)
    exercise = ((report or {}).get('plan') or {}).get('exercise') or {}
    marks = {m.task: m for m in db.query(models.DailyTaskMark).filter_by(user_id=user.id, day=day).all()}
    tasks = daily_tasks.choose_tasks({'injured': injured, 'checked_in': checked, 'plan_today': planned_today(db, user, day),
                                      'post_meal_walk': bool(exercise.get('post_meal_walk')), 'walk_done': 'walk' in marks,
                                      'move_done': 'move' in marks and marks['move'].ticked, 'water_ml': now['water_ml'], 'water_goal_ml': now['water_goal_ml'],
                                      'meals_today': now['meals'], 'sleep_logged': bool(now['sleep_hours']), 'active_min_today': now['active_min']})
    # Tasks the data shows as done are recorded, so the streak remembers the day even if the data changes later.
    for t in tasks:
        if t['done'] and t['id'] not in marks:
            db.add(models.DailyTaskMark(user_id=user.id, day=day, task=t['id'], ticked=False))
    db.commit()
    mark_days = sorted({row[0] for row in db.query(models.DailyTaskMark.day).filter_by(user_id=user.id).all()})
    first = date.fromisoformat(mark_days[0]) if mark_days else today
    rests = [str(first + timedelta(days=i)) for i in range((today - first).days + 1) if (first + timedelta(days=i)).weekday() in prefs.rest_days]
    streak = gamification.flexible_streak(mark_days, rests, today)
    targets = targets_view(user, db)
    task_days = sum(d['day'] in set(mark_days) for d in week)
    return {'today': day, 'tasks': tasks, 'done': sum(t['done'] for t in tasks),
            'streak': {'current': streak['current'], 'best': streak['best'], 'protected_days': streak['protected_days'][-5:],
                       'rule': tr('Days with a task done. One missed day a week is covered, and planned rest days keep it going.')},
            'health': daily_tasks.health_score(week, {'calories': targets.get('calories'), 'protein': targets.get('protein')}, task_days)}


def task_done(data: TaskDone, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Tick (or untick) a task only the person can confirm, like a walk after meals."""
    consume(db, 'task-done', str(user.id), 60, 3600)
    prefs = prefs_for(db.get(models.PersonalizationProfile, user.id))
    day = str(local_now(prefs).date())
    row = db.query(models.DailyTaskMark).filter_by(user_id=user.id, day=day, task=data.task).first()
    if data.done and not row:
        db.add(models.DailyTaskMark(user_id=user.id, day=day, task=data.task, ticked=True))
    elif not data.done and row:
        db.delete(row)
    db.commit()
    return today_view(user, db)


def history_summary(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Monthly summaries of everything the person has logged (up to a year), free for everyone, plus how far detail goes back."""
    from services.history_access import access, monthly
    prefs = prefs_for(db.get(models.PersonalizationProfile, user.id))
    today = local_now(prefs).date()
    start = date(today.year - 1, today.month, 1)
    tz = ZoneInfo(prefs.timezone)
    days = {}
    def day_of(key):
        return days.setdefault(key, {'day': key, 'meals': 0, 'kcal': 0.0, 'water_ml': 0, 'sleep_hours': None, 'active_min': 0, 'logged_min': 0, 'workouts': 0, 'weight_kg': None})
    for r in db.query(models.DailyWellness).filter(models.DailyWellness.user_id == user.id, models.DailyWellness.day >= str(start)).all():
        d = day_of(r.day); d['water_ml'] = r.water_ml or 0; d['sleep_hours'] = r.sleep_hours; d['active_min'] = max(d['active_min'], r.active_minutes or 0)
        if r.weight_kg: d['weight_kg'] = r.weight_kg
    since = datetime.combine(start, datetime.min.time())
    for m in db.query(models.MealLog).filter(models.MealLog.user_id == user.id, models.MealLog.is_deleted.is_(False), models.MealLog.logged_at >= since).all():
        d = day_of(str(m.logged_at.replace(tzinfo=timezone.utc).astimezone(tz).date())); d['meals'] += 1; d['kcal'] += m.total_calories or 0
    for w in db.query(models.WorkoutEntry).filter(models.WorkoutEntry.user_id == user.id, models.WorkoutEntry.is_deleted.is_(False), models.WorkoutEntry.day >= str(start)).all():
        d = day_of(w.day); d['workouts'] += 1; d['logged_min'] += w.minutes or 0
    for a in db.query(models.Activity).filter(models.Activity.user_id == user.id, models.Activity.is_deleted.is_(False), models.Activity.started_at >= since).all():
        d = day_of(str(a.started_at.replace(tzinfo=timezone.utc).astimezone(tz).date())); d['workouts'] += 1; d['logged_min'] += round((a.moving_s or 0) / 60)
    for w in db.query(models.WellnessMeasurement).filter(models.WellnessMeasurement.user_id == user.id, models.WellnessMeasurement.kind == 'weight',
                                                         models.WellnessMeasurement.recorded_at >= since).order_by(models.WellnessMeasurement.recorded_at).all():
        day_of(str(w.recorded_at.replace(tzinfo=timezone.utc).astimezone(tz).date()))['weight_kg'] = w.canonical_value
    for d in days.values():
        d['active_min'] = max(d['active_min'], d.pop('logged_min'))   # the same walk is often in both: count it once, as the Health Score does
    return {'history': access(db, user, today), 'months': monthly(list(days.values()))}


def progress_view(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Every area the person tracks, this week against last week (services/progress_areas.py), for the Progress page."""
    from services import progress_areas
    from services import wellness_days as wd
    prefs = prefs_for(db.get(models.PersonalizationProfile, user.id))
    today = local_now(prefs).date()
    targets = targets_view(user, db)
    return progress_areas.collect(db, user, prefs.timezone, today, {'calories': targets.get('calories'), 'protein': targets.get('protein')},
                                  wd.water_goal(latest_weight(db, user)), getattr(prefs, 'goal', None))
