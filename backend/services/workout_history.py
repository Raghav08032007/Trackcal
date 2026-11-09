"""One workout history: camera and gym sessions, workouts logged by hand, and recorded routes, newest first.
Also the person's training library (circuits, program progress, next rep targets) with changes that merge across devices."""
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator

import models

KINDS = ('all', 'camera', 'gym', 'manual', 'route')
ROUTE_TITLES = {'run': 'Run', 'walk': 'Walk', 'hike': 'Hike', 'ride': 'Ride'}
ID = re.compile(r'^[a-zA-Z0-9_-]{1,40}$')
PROGRAM_DAY = re.compile(r'^[a-z0-9-]{1,30}:\d{1,4}$')


class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')


class EntryInput(Strict):
    day: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    name: str = Field(min_length=1, max_length=120)
    minutes: int = Field(0, ge=0, le=1440)
    sets: int = Field(0, ge=0, le=200)
    reps: int = Field(0, ge=0, le=1000)
    load: float = Field(0, ge=0, le=1000, allow_inf_nan=False)
    source: str = Field('Manual entry', max_length=40)

    @field_validator('name', 'source')
    @classmethod
    def trimmed(cls, value):
        value = ' '.join(value.split())
        if not value: raise ValueError('Give the workout a name.')
        return value


class NewEntry(EntryInput):
    id: str = Field(pattern=r'^[0-9a-fA-F-]{36}$')


class Step(Strict):
    kind: str = Field(pattern=r'^[a-z_]{1,30}$')
    target: int = Field(ge=1, le=100)


class Circuit(Strict):
    id: str = Field(pattern=ID.pattern)
    name: str = Field(min_length=1, max_length=80)
    rest: int = Field(ge=0, le=180)
    steps: list[Step] = Field(min_length=1, max_length=12)


class NextTarget(Strict):
    kind: str = Field(pattern=r'^[a-z_]{1,30}$')
    target: int = Field(ge=1, le=100)


class ProgramDays(Strict):
    add: list[str] = Field(default_factory=list, max_length=100)
    clear: list[str] = Field(default_factory=list, max_length=20)      # program ids to start again

    @field_validator('add')
    @classmethod
    def day_ids(cls, values):
        if any(not PROGRAM_DAY.match(v) for v in values): raise ValueError('Unknown program day.')
        return values


class LibraryChange(Strict):
    """Each part changes only what it names, so a circuit saved on one phone and a program day done on another both stay."""
    save_circuits: list[Circuit] = Field(default_factory=list, max_length=50)
    remove_circuits: list[str] = Field(default_factory=list, max_length=50)
    program_days: ProgramDays = Field(default_factory=ProgramDays)
    next_targets: list[NextTarget] = Field(default_factory=list, max_length=100)


class LibraryImport(Strict):
    workouts: list[NewEntry] = Field(default_factory=list, max_length=500)
    circuits: list[Circuit] = Field(default_factory=list, max_length=50)
    program_days: list[str] = Field(default_factory=list, max_length=500)
    next_targets: list[NextTarget] = Field(default_factory=list, max_length=100)


# ── Library ──

def library(db, user_id, lock=False):
    q = db.query(models.TrainingLibrary).filter_by(user_id=user_id)
    row = (q.with_for_update() if lock else q).first()
    if not row and lock:
        row = models.TrainingLibrary(user_id=user_id, circuits=[], program_days=[], next_targets=[]); db.add(row); db.flush()
    return row


def library_view(row):
    return {'circuits': list(row.circuits) if row else [], 'program_days': list(row.program_days) if row else [], 'next_targets': list(row.next_targets) if row else []}


def change_library(row, change: LibraryChange):
    circuits = [c for c in row.circuits if c['id'] not in set(change.remove_circuits)]
    for c in change.save_circuits:
        data = c.model_dump(); circuits = [x for x in circuits if x['id'] != c.id] + [data]
    if len(circuits) > 50: raise ValueError('Keep up to 50 circuits.')
    days = [d for d in row.program_days if d.split(':')[0] not in set(change.program_days.clear)]
    days += [d for d in change.program_days.add if d not in days]
    if len(days) > 500: raise ValueError('Too many program days.')
    targets = {t['kind']: t['target'] for t in row.next_targets}
    targets.update({t.kind: t.target for t in change.next_targets})
    row.circuits, row.program_days, row.next_targets = circuits, days, [{'kind': k, 'target': v} for k, v in targets.items()][:100]


def import_library(row, data: LibraryImport):
    """Browser-only training data, copied once: circuits and program days are added; next targets only fill gaps."""
    known = {c['id'] for c in row.circuits}
    row.circuits = (list(row.circuits) + [c.model_dump() for c in data.circuits if c.id not in known])[:50]
    row.program_days = (list(row.program_days) + [d for d in dict.fromkeys(data.program_days) if PROGRAM_DAY.match(d) and d not in row.program_days])[:500]
    have = {t['kind'] for t in row.next_targets}
    row.next_targets = (list(row.next_targets) + [t.model_dump() for t in data.next_targets if t.kind not in have])[:100]


# ── History ──

def _utc(value):
    return value.replace(tzinfo=timezone.utc)


def session_item(row, zone, names):
    exercises = row.details.get('exercises', []) if isinstance(row.details, dict) else []
    sets = [s for e in exercises for s in e.get('sets', [])]
    camera = row.details.get('tracking_method') == 'camera'
    at = _utc(row.completed_at or row.started_at)
    reps = sum(int(s.get('reps') or 0) for s in sets); heaviest = max([float(s.get('load') or 0) for s in sets] or [0])
    parts = [f"{len(sets)} set{'s' if len(sets) != 1 else ''}" if sets else '', f'{reps} reps' if reps else '', f'up to {heaviest:g} kg' if heaviest else '']
    return {'id': row.id, 'kind': 'camera' if camera else 'gym', 'title': row.name, 'at': at.isoformat().replace('+00:00', 'Z'), 'day': at.astimezone(zone).date().isoformat(),
            'minutes': round(row.recorded_minutes or 0), 'sets': len(sets), 'reps': reps, 'load': heaviest, 'detail': ' · '.join(p for p in parts if p),
            'exercises': [names.get(e.get('exercise_id'), e.get('exercise_id')) for e in exercises], 'status': row.status, 'removable': True, 'editable': False}


def entry_at(row, zone):
    """Hand-logged workouts sort by when they were saved if that was on their day, else midday of their day."""
    created = _utc(row.created_at).astimezone(zone)
    if created.date().isoformat() == row.day: return created
    return datetime.combine(date.fromisoformat(row.day), time(12), zone)


def entry_item(row, zone):
    at = entry_at(row, zone)
    parts = [f'{row.sets} × {row.reps}' if row.sets and row.reps else '', f'{row.load_kg:g} kg' if row.load_kg else '']
    return {'id': row.id, 'kind': 'manual', 'title': row.name, 'at': at.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z'), 'day': row.day, 'minutes': row.minutes,
            'sets': row.sets, 'reps': row.reps, 'load': row.load_kg, 'detail': ' · '.join(p for p in parts if p), 'source': row.source, 'status': 'completed', 'removable': True, 'editable': True}


def route_item(row, zone):
    at = _utc(row.started_at)
    km = row.distance_m / 1000
    return {'id': row.id, 'kind': 'route', 'title': row.name or ROUTE_TITLES.get(row.sport, 'Activity'), 'sport': row.sport, 'at': at.isoformat().replace('+00:00', 'Z'),
            'day': at.astimezone(zone).date().isoformat(), 'minutes': round((row.moving_s or 0) / 60), 'distance_m': row.distance_m,
            'detail': f'{km:.2f} km' + (f' · {round(row.elevation_gain_m)} m climb' if row.elevation_gain_m and row.elevation_gain_m >= 1 else ''),
            'status': 'completed', 'removable': False, 'editable': False, 'link': f'/activity?id={row.id}'}


def history(db, user_id, tz, kind='all', offset=0, limit=20, names=None):
    zone, take = ZoneInfo(tz), offset + limit + 1
    items = []
    if kind in ('all', 'camera', 'gym'):
        rows = db.query(models.WorkoutSession).filter_by(user_id=user_id, is_deleted=False, status='completed') \
            .order_by(models.WorkoutSession.completed_at.desc()).limit(take * (2 if kind != 'all' else 1)).all()
        items += [i for i in (session_item(r, zone, names or {}) for r in rows) if kind == 'all' or i['kind'] == kind]
    if kind in ('all', 'manual'):
        rows = db.query(models.WorkoutEntry).filter_by(user_id=user_id, is_deleted=False).order_by(models.WorkoutEntry.day.desc(), models.WorkoutEntry.created_at.desc()).limit(take).all()
        items += [entry_item(r, zone) for r in rows]
    if kind in ('all', 'route'):
        rows = db.query(models.Activity).filter_by(user_id=user_id, is_deleted=False).filter(models.Activity.session_id.is_(None)) \
            .order_by(models.Activity.started_at.desc()).limit(take).all()
        items += [route_item(r, zone) for r in rows]
    items.sort(key=lambda i: (i['at'], i['id']), reverse=True)
    return {'items': items[offset:offset + limit], 'has_more': len(items) > offset + limit, 'kind': kind, 'offset': offset}


def active_days(db, user_id, tz, days=120):
    """Every local day with any finished workout in the last `days` days, for streaks and habits."""
    zone = ZoneInfo(tz); since = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days + 1)
    found = set()
    for (at,) in db.query(models.WorkoutSession.completed_at).filter(models.WorkoutSession.user_id == user_id, models.WorkoutSession.is_deleted.is_(False),
                                                                    models.WorkoutSession.status == 'completed', models.WorkoutSession.completed_at >= since):
        found.add(_utc(at).astimezone(zone).date().isoformat())
    for (at,) in db.query(models.Activity.started_at).filter(models.Activity.user_id == user_id, models.Activity.is_deleted.is_(False), models.Activity.started_at >= since):
        found.add(_utc(at).astimezone(zone).date().isoformat())
    for (day,) in db.query(models.WorkoutEntry.day).filter(models.WorkoutEntry.user_id == user_id, models.WorkoutEntry.is_deleted.is_(False), models.WorkoutEntry.day >= since.date().isoformat()):
        found.add(day)
    return sorted(found)
