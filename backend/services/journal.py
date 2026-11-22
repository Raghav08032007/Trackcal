"""The journal: every workout (camera, gym session, hand-logged, GPS route) and every meal, totalled per day for any
period, the best day, month and year, and workouts planned for coming days.

"Best" for workouts is the most active minutes; for food it is the most complete logging (meals on a day, logged days
in a month or year), because steady logging is what makes food tracking accurate, not eating more."""
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.exc import SQLAlchemyError

import models

MAX_SPAN_DAYS = 400          # a year and a bit, so "this year" always fits
BEST_SINCE_DAYS = 3 * 366    # bests look back three years


class PlanInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), pattern=r'^[0-9a-fA-F-]{36}$')
    day: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    name: str = Field(min_length=1, max_length=120)
    minutes: int = Field(0, ge=0, le=1440)
    sets: int = Field(0, ge=0, le=100)
    reps: int = Field(0, ge=0, le=1000)
    load: float = Field(0, ge=0, le=1000)
    notes: str = Field('', max_length=300)

    @field_validator('day')
    @classmethod
    def real_day(cls, value):
        date.fromisoformat(value)
        return value


def _utc(value):
    return value.replace(tzinfo=timezone.utc)


def _span(start, end):
    a, b = date.fromisoformat(start), date.fromisoformat(end)
    if b < a: a, b = b, a
    if (b - a).days > MAX_SPAN_DAYS: a = b - timedelta(days=MAX_SPAN_DAYS)
    return a, b


def _bounds(a, b, zone):
    """The UTC instants that cover local days a..b (with a day of slack each side; days are re-checked locally)."""
    lo = datetime.combine(a - timedelta(days=1), time.min, zone).astimezone(timezone.utc).replace(tzinfo=None)
    hi = datetime.combine(b + timedelta(days=2), time.min, zone).astimezone(timezone.utc).replace(tzinfo=None)
    return lo, hi


def day_totals(db, user_id, tz, a, b):
    """Per local day: workouts, active minutes, reps, distance, meals, calories and protein."""
    zone = ZoneInfo(tz); lo, hi = _bounds(a, b, zone)
    first, last = a.isoformat(), b.isoformat()
    days = defaultdict(lambda: {'workouts': 0, 'minutes': 0, 'reps': 0, 'km': 0.0, 'meals': 0, 'kcal': 0.0, 'protein': 0.0, 'kinds': set()})

    def add(day, **values):
        if first <= day <= last:
            d = days[day]
            for k, v in values.items():
                if k == 'kind': d['kinds'].add(v)
                else: d[k] += v

    sessions = db.query(models.WorkoutSession).filter(models.WorkoutSession.user_id == user_id, models.WorkoutSession.is_deleted.is_(False),
                                                      models.WorkoutSession.status == 'completed', models.WorkoutSession.completed_at >= lo,
                                                      models.WorkoutSession.completed_at < hi)
    for s in sessions:
        details = s.details if isinstance(s.details, dict) else {}
        reps = sum(int(x.get('reps') or 0) for e in details.get('exercises', []) for x in e.get('sets', []))
        add(_utc(s.completed_at).astimezone(zone).date().isoformat(), workouts=1, minutes=round(s.recorded_minutes or 0), reps=reps,
            kind='camera' if details.get('tracking_method') == 'camera' else 'gym')
    for e in db.query(models.WorkoutEntry).filter(models.WorkoutEntry.user_id == user_id, models.WorkoutEntry.is_deleted.is_(False),
                                                  models.WorkoutEntry.day >= first, models.WorkoutEntry.day <= last):
        add(e.day, workouts=1, minutes=e.minutes, reps=(e.sets or 0) * (e.reps or 0), kind='manual')
    for r in db.query(models.Activity).filter(models.Activity.user_id == user_id, models.Activity.is_deleted.is_(False),
                                              models.Activity.session_id.is_(None), models.Activity.started_at >= lo, models.Activity.started_at < hi):
        add(_utc(r.started_at).astimezone(zone).date().isoformat(), workouts=1, minutes=round((r.moving_s or 0) / 60), km=(r.distance_m or 0) / 1000, kind='route')
    for m in db.query(models.MealLog).filter(models.MealLog.user_id == user_id, models.MealLog.is_deleted.is_(False),
                                             models.MealLog.logged_at >= lo, models.MealLog.logged_at < hi):
        add(_utc(m.logged_at).astimezone(zone).date().isoformat(), meals=1, kcal=m.total_calories or 0, protein=m.total_protein_g or 0)
    return {k: {**v, 'kinds': sorted(v['kinds']), 'km': round(v['km'], 2), 'kcal': round(v['kcal']), 'protein': round(v['protein'], 1)} for k, v in days.items()}


def _best(days, key, period):
    """The day, month (YYYY-MM) or year (YYYY) with the highest value of `key` (for logged days, counts days)."""
    groups = defaultdict(float)
    for day, d in days.items():
        label = day if period == 'day' else day[:7] if period == 'month' else day[:4]
        groups[label] += (1 if d[key] > 0 else 0) if key == 'logged' else d[key]
    groups = {k: v for k, v in groups.items() if v > 0}
    if not groups: return None
    label = max(groups, key=lambda k: (groups[k], k))
    return {'period': label, 'value': round(groups[label], 1)}


def bests(db, user_id, tz, today):
    days = day_totals(db, user_id, tz, today - timedelta(days=BEST_SINCE_DAYS), today)
    for d in days.values(): d['logged'] = d['meals']
    return {'workouts': {p: _best(days, 'minutes', p) for p in ('day', 'month', 'year')},
            'food': {'day': _best(days, 'meals', 'day'), 'month': _best(days, 'logged', 'month'), 'year': _best(days, 'logged', 'year')}}


def plans(db, user_id, a, b):
    """Planned workouts in a..b, or an empty list while the table isn't there yet (migration 0030 not applied)."""
    try:
        rows = db.query(models.PlannedWorkout).filter(models.PlannedWorkout.user_id == user_id, models.PlannedWorkout.day >= a.isoformat(),
                                                      models.PlannedWorkout.day <= b.isoformat()).order_by(models.PlannedWorkout.day).all()
    except SQLAlchemyError:
        db.rollback(); return []
    return [plan_view(r) for r in rows]


def plan_view(r):
    return {'id': r.id, 'day': r.day, 'name': r.name, 'minutes': r.minutes, 'sets': r.sets, 'reps': r.reps, 'load': r.load_kg, 'notes': r.notes,
            'done': bool(r.done_entry_id)}


def summary(db, user_id, tz, start, end, today):
    a, b = _span(start, end)
    days = day_totals(db, user_id, tz, a, b)
    totals = {k: round(sum(d[k] for d in days.values()), 2 if k == 'km' else 0) for k in ('workouts', 'minutes', 'reps', 'km', 'meals', 'kcal')}
    totals['active_days'] = sum(1 for d in days.values() if d['workouts']); totals['logged_days'] = sum(1 for d in days.values() if d['meals'])
    return {'from': a.isoformat(), 'to': b.isoformat(), 'days': [{'day': k, **v} for k, v in sorted(days.items())], 'totals': totals,
            'best': bests(db, user_id, tz, today), 'plans': plans(db, user_id, a, b + timedelta(days=60))}
