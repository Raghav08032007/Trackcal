"""One workout history, hand-logged workouts with undo, and the training library (services/workout_history.py)."""
import uuid
from datetime import date, datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from flask_app.params import Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
from database import get_db
from routers.auth import get_current_active_user
from services import workout_history as rules
from services.personalization_inputs import Preferences
from services.workout_history import EntryInput, LibraryChange, LibraryImport, NewEntry


def zone_name(db, user):
    row = db.get(models.PersonalizationProfile, user.id)
    return Preferences.model_validate(row.preferences).timezone if row else 'UTC'


def exercise_names():
    from routers.training import catalog
    return {c['id']: c['name'] for c in catalog()}


def check_day(day, tz):
    try: value = date.fromisoformat(day)
    except ValueError: raise HTTPException(422, 'That date does not exist.')
    today = datetime.now(timezone.utc).astimezone(ZoneInfo(tz)).date()
    if value < date(2000, 1, 1) or value > today + timedelta(days=1): raise HTTPException(422, 'Workouts can be logged up to today.')


def history(kind: str = Query('all', max_length=10), offset: int = Query(0, ge=0, le=1000), limit: int = Query(20, ge=1, le=50),
            user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    if kind not in rules.KINDS: raise HTTPException(422, 'Choose all, camera, gym, manual or route.')
    tz = zone_name(db, user)
    result = rules.history(db, user.id, tz, kind, offset, limit, exercise_names())
    if offset == 0: result['active_days'] = rules.active_days(db, user.id, tz)
    return result


def owned_entry(db, user, identifier, deleted=False):
    row = db.query(models.WorkoutEntry).filter_by(id=str(identifier), user_id=user.id, is_deleted=deleted).with_for_update().first()
    if not row: raise HTTPException(404, 'Workout not found.')
    return row


def add_entry(data: NewEntry, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    tz = zone_name(db, user); check_day(data.day, tz)
    prior = db.get(models.WorkoutEntry, data.id.lower())
    if prior:                                                       # the same save sent twice
        if prior.user_id != user.id: raise HTTPException(404, 'Workout not found.')
        return rules.entry_item(prior, ZoneInfo(tz))
    row = models.WorkoutEntry(id=data.id.lower(), user_id=user.id, day=data.day, name=data.name, minutes=data.minutes, sets=data.sets, reps=data.reps, load_kg=data.load, source=data.source)
    db.add(row); db.commit(); return rules.entry_item(row, ZoneInfo(tz))


def edit_entry(identifier: UUID, data: EntryInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    tz = zone_name(db, user); check_day(data.day, tz); row = owned_entry(db, user, identifier)
    row.day, row.name, row.minutes, row.sets, row.reps, row.load_kg, row.source = data.day, data.name, data.minutes, data.sets, data.reps, data.load, data.source
    db.commit(); return rules.entry_item(row, ZoneInfo(tz))


def remove_entry(identifier: UUID, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = owned_entry(db, user, identifier); row.is_deleted = True; db.commit(); return {'status': 'removed', 'id': row.id}


def restore_entry(identifier: UUID, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = owned_entry(db, user, identifier, deleted=True); row.is_deleted = False; db.commit()
    return rules.entry_item(row, ZoneInfo(zone_name(db, user)))


def restore_session(identifier: UUID, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Undo a deleted session. Only finished sessions come back; points were never taken away, so none are added."""
    row = db.query(models.WorkoutSession).filter_by(id=str(identifier), user_id=user.id, is_deleted=True, status='completed').with_for_update().first()
    if not row: raise HTTPException(404, 'Session not found.')
    row.is_deleted = False; db.commit()
    return rules.session_item(row, ZoneInfo(zone_name(db, user)), exercise_names())


def get_library(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    return rules.library_view(rules.library(db, user.id))


def change_library(data: LibraryChange, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = rules.library(db, user.id, lock=True)
    try: rules.change_library(row, data)
    except ValueError as failure: raise HTTPException(422, str(failure))
    db.commit(); return rules.library_view(row)


def import_library(data: LibraryImport, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Workouts, circuits and program progress kept only in this browser, copied once. Copying twice changes nothing."""
    tz = zone_name(db, user); today = datetime.now(timezone.utc).astimezone(ZoneInfo(tz)).date().isoformat()
    row = rules.library(db, user.id, lock=True); rules.import_library(row, data); added = 0
    for item in data.workouts:
        if item.day > today or item.day < '2000-01-01': continue
        identifier, prior = item.id.lower(), db.get(models.WorkoutEntry, item.id.lower())
        if prior and prior.user_id == user.id: continue                 # already copied
        if prior: identifier = str(uuid.uuid4())                         # someone else's id: keep the workout under a new one
        db.add(models.WorkoutEntry(id=identifier, user_id=user.id, day=item.day, name=item.name, minutes=item.minutes, sets=item.sets, reps=item.reps, load_kg=item.load, source=item.source)); added += 1
    db.commit(); return {'workouts': added, **rules.library_view(row)}
