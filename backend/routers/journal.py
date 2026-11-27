"""The journal: totals per day for any period, the best day/month/year, and planned workouts (services/journal.py)."""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from flask_app.params import Depends, HTTPException, Query
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import models
from database import get_db
from routers.auth import get_current_active_user
from services.i18n import tr
from routers.workout_history import zone_name
from services import journal as rules
from services.journal import PlanInput

PLAN_AHEAD_DAYS = 366


def _today(tz):
    return datetime.now(ZoneInfo(tz)).date()


def _day(value, name):
    try: return date.fromisoformat(value)
    except (TypeError, ValueError): raise HTTPException(422, tr('Choose a real start date.') if name == 'start' else tr('Choose a real end date.'))


def journal(start: str = Query('', max_length=10), end: str = Query('', max_length=10),
            user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    tz = zone_name(db, user); today = _today(tz)
    a = _day(start, 'start') if start else today - timedelta(days=6)
    b = _day(end, 'end') if end else today
    from services.history_access import access
    since = access(db, user, today)['from']           # older detail is Premium, as in the workout history
    if since and a.isoformat() < since: a = date.fromisoformat(since)
    if b > today: b = today
    if a > b: a = b
    result = rules.summary(db, user.id, tz, a.isoformat(), b.isoformat(), today)
    result['history_from'] = since
    return result


def _plans_table(db):
    try: db.query(models.PlannedWorkout.id).limit(1).all()
    except SQLAlchemyError:
        db.rollback(); raise HTTPException(503, 'Planning is being set up. Try again after the next update.')


def add_plan(data: PlanInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    _plans_table(db)
    today = _today(zone_name(db, user)); day = date.fromisoformat(data.day)
    if day < today - timedelta(days=1) or day > today + timedelta(days=PLAN_AHEAD_DAYS): raise HTTPException(422, 'Plan a workout from today up to a year ahead.')
    prior = db.get(models.PlannedWorkout, data.id.lower())
    if prior:
        if prior.user_id != user.id: raise HTTPException(404, 'Plan not found.')
        return rules.plan_view(prior)
    if db.query(models.PlannedWorkout).filter_by(user_id=user.id, done_entry_id=None).filter(models.PlannedWorkout.day >= today.isoformat()).count() >= 200:
        raise HTTPException(422, 'Keep up to 200 planned workouts.')
    row = models.PlannedWorkout(id=data.id.lower(), user_id=user.id, day=data.day, name=data.name, minutes=data.minutes, sets=data.sets, reps=data.reps,
                                load_kg=data.load, notes=data.notes)
    db.add(row); db.commit(); return rules.plan_view(row)


def _owned(db, user, identifier):
    _plans_table(db)
    row = db.query(models.PlannedWorkout).filter_by(id=str(identifier).lower(), user_id=user.id).with_for_update().first()
    if not row: raise HTTPException(404, 'Plan not found.')
    return row


def remove_plan(identifier: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = _owned(db, user, identifier); db.delete(row); db.commit(); return {'removed': identifier}


def done_plan(identifier: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Marks a plan done: it is saved as a hand-logged workout on its day (so it counts like any other workout)."""
    row = _owned(db, user, identifier)
    if row.done_entry_id: return rules.plan_view(row)
    if row.day > _today(zone_name(db, user)).isoformat(): raise HTTPException(422, 'You can mark it done on its day.')
    entry = models.WorkoutEntry(id=row.id, user_id=user.id, day=row.day, name=row.name, minutes=row.minutes, sets=row.sets, reps=row.reps,
                                load_kg=row.load_kg, source='Planned workout')
    db.add(entry); row.done_entry_id = entry.id; db.commit(); return rules.plan_view(row)
