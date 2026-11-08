"""GPS activities: record, list, view, share and personal records. Stats come from services/activity_stats.py, never from the phone."""
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends, HTTPException, Query
from routers.auth import get_current_active_user
from routers.social import blocks_between, follows
from services import activity_stats
from services.abuse_limits import consume
from timeutil import utcnow

Sport = Literal['walk', 'run', 'hike', 'ride']
Visibility = Literal['private', 'followers', 'everyone']
SHARED_END_HIDDEN_M = 200
MAX_ZONES = 5


class ActivityInput(BaseModel):
    id: Optional[str] = Field(default=None, min_length=36, max_length=36)
    sport: Sport
    name: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=2000)
    visibility: Visibility = 'private'
    started_at: datetime
    session_id: Optional[str] = Field(default=None, min_length=36, max_length=36)
    fixes: list = Field(max_length=activity_stats.MAX_FIXES)

    @field_validator('started_at')
    @classmethod
    def recent(cls, value):
        value = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if not now - timedelta(days=30) <= value <= now + timedelta(minutes=10):
            raise ValueError('An activity must have started within the last 30 days.')
        return value.astimezone(timezone.utc).replace(tzinfo=None)


class ActivityEdit(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=2000)
    visibility: Optional[Visibility] = None


class ZoneInput(BaseModel):
    label: str = Field(min_length=1, max_length=40)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    radius_m: int = Field(default=300, ge=100, le=1000)


def default_name(sport, started_at):
    hour = started_at.hour
    part = 'Morning' if 5 <= hour < 12 else 'Afternoon' if 12 <= hour < 17 else 'Evening' if 17 <= hour < 22 else 'Night'
    return f'{part} {activity_stats.SPORTS[sport][2].lower()}'


def summary(row, route=None):
    s = row.stats or {}
    return {'id': row.id, 'sport': row.sport, 'name': row.name, 'notes': row.notes, 'visibility': row.visibility,
            'started_at': row.started_at.isoformat() + 'Z', 'distance_m': row.distance_m, 'moving_s': row.moving_s, 'elapsed_s': row.elapsed_s,
            'elevation_gain_m': row.elevation_gain_m, 'elevation_loss_m': s.get('elevation_loss_m', 0), 'avg_speed_ms': s.get('avg_speed_ms', 0),
            'max_speed_ms': s.get('max_speed_ms', 0), 'user_id': row.user_id, **({'route': route} if route is not None else {})}


def preview(route, points=60):
    """A thin outline for list thumbnails."""
    if len(route) <= points:
        return [[p[0], p[1]] for p in route]
    step = (len(route) - 1) / (points - 1)
    return [[route[round(i * step)][0], route[round(i * step)][1]] for i in range(points)]


def zones_of(db, user_id):
    return db.query(models.PrivacyZone).filter(models.PrivacyZone.user_id == user_id).all()


def shared_route(db, row):
    """What anyone but the owner sees: no start or end, and nothing inside the owner's privacy zones."""
    route = row.route or []
    if not route:
        return []
    circles = [(route[0][0], route[0][1], SHARED_END_HIDDEN_M), (route[-1][0], route[-1][1], SHARED_END_HIDDEN_M)]
    circles += [(z.lat, z.lon, z.radius_m) for z in zones_of(db, row.user_id)]
    return activity_stats.hide_near(route, circles)


def can_view(db, viewer, row):
    if row.is_deleted:
        return False
    if row.user_id == viewer.id:
        return True
    if blocks_between(db, viewer.id, row.user_id):
        return False
    return row.visibility == 'everyone' or (row.visibility == 'followers' and follows(db, viewer.id, row.user_id) == 'active')


def owned(db, user, activity_id):
    row = db.get(models.Activity, activity_id)
    if not row or row.is_deleted or row.user_id != user.id:
        raise HTTPException(status_code=404, detail='Activity not found.')
    return row


def bests(db, user_id, sport, exclude=None):
    """Fastest time per standard distance, longest distance and biggest climb across this person's activities of one sport."""
    rows = db.query(models.Activity).filter(models.Activity.user_id == user_id, models.Activity.sport == sport, models.Activity.is_deleted.is_(False))
    if exclude:
        rows = rows.filter(models.Activity.id != exclude)
    efforts, longest, climb = {}, None, None
    for row in rows.all():
        for e in (row.stats or {}).get('best_efforts', []):
            if e['label'] not in efforts or e['seconds'] < efforts[e['label']]['seconds']:
                efforts[e['label']] = {**e, 'activity_id': row.id, 'date': row.started_at.date().isoformat()}
        if longest is None or row.distance_m > longest['distance_m']:
            longest = {'distance_m': row.distance_m, 'activity_id': row.id, 'date': row.started_at.date().isoformat()}
        if row.elevation_gain_m and (climb is None or row.elevation_gain_m > climb['elevation_gain_m']):
            climb = {'elevation_gain_m': row.elevation_gain_m, 'activity_id': row.id, 'date': row.started_at.date().isoformat()}
    order = [label for _, label in activity_stats.BEST_EFFORTS]
    return {'best_efforts': sorted(efforts.values(), key=lambda e: order.index(e['label'])), 'longest': longest, 'biggest_climb': climb}


def new_records(before, row):
    """What this activity beat: each faster best effort, a longer distance, a bigger climb."""
    out = []
    old = {e['label']: e['seconds'] for e in before['best_efforts']}
    for e in row.stats.get('best_efforts', []):
        if e['label'] not in old or e['seconds'] < old[e['label']]:
            out.append({'kind': 'best_effort', 'label': e['label'], 'seconds': e['seconds'], 'previous_seconds': old.get(e['label'])})
    if before['longest'] and row.distance_m > before['longest']['distance_m']:
        out.append({'kind': 'longest', 'label': 'Longest', 'distance_m': row.distance_m, 'previous_m': before['longest']['distance_m']})
    if before['biggest_climb'] and row.elevation_gain_m > before['biggest_climb']['elevation_gain_m']:
        out.append({'kind': 'climb', 'label': 'Biggest climb', 'elevation_gain_m': row.elevation_gain_m})
    return out


def detail(db, viewer, row):
    mine = row.user_id == viewer.id
    data = summary(row, row.route if mine else shared_route(db, row))
    data.update({'splits': row.stats.get('splits', []), 'best_efforts': row.stats.get('best_efforts', []), 'mine': mine})
    if mine:
        data.update({'fixes_used': row.stats.get('fixes_used', 0), 'fixes_dropped': row.stats.get('fixes_dropped', 0)})
    else:
        # The route's ends are hidden, so its per-point times and distances must not give the start away either.
        data['route'] = [[p[0], p[1], None, p[3], None] for p in data['route']]
    return data


def create(data: ActivityInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    consume(db, 'activity-create', str(user.id), 60, 3600)
    if data.id:
        existing = db.get(models.Activity, data.id)
        if existing:
            if existing.user_id != user.id:
                raise HTTPException(status_code=409, detail='That activity id is already used.')
            return {'activity': detail(db, user, existing), 'new_records': []}
    if data.session_id:
        session = db.get(models.WorkoutSession, data.session_id)
        if not session or session.user_id != user.id:
            raise HTTPException(status_code=404, detail='Workout not found.')
    result = activity_stats.analyse(data.fixes, data.sport)
    if result['fixes_used'] < 2 or result['elapsed_s'] < 30:
        raise HTTPException(status_code=422, detail='Not enough GPS fixes to save this activity. Try again outdoors with a clear view of the sky.')
    before = bests(db, user.id, data.sport)
    route = result.pop('route')
    row = models.Activity(id=data.id or None, user_id=user.id, session_id=data.session_id, sport=data.sport,
                          name=(data.name or '').strip() or default_name(data.sport, data.started_at), notes=data.notes, visibility=data.visibility,
                          started_at=data.started_at, distance_m=result['distance_m'], moving_s=result['moving_s'], elapsed_s=result['elapsed_s'],
                          elevation_gain_m=result['elevation_gain_m'], stats=result, route=route)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'activity': detail(db, user, row), 'new_records': new_records(before, row)}


def list_activities(sport: Optional[Sport] = Query(None), before: Optional[str] = Query(None), limit: int = Query(20, ge=1, le=50),
                    user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    rows = db.query(models.Activity).filter(models.Activity.user_id == user.id, models.Activity.is_deleted.is_(False))
    if sport:
        rows = rows.filter(models.Activity.sport == sport)
    if before:
        try:
            rows = rows.filter(models.Activity.started_at < datetime.fromisoformat(before.rstrip('Z')))
        except ValueError:
            raise HTTPException(status_code=422, detail='before must be an ISO date and time.')
    rows = rows.order_by(models.Activity.started_at.desc()).limit(limit + 1).all()
    items = [{**summary(r), 'preview': preview(r.route or [])} for r in rows[:limit]]
    week_start = utcnow() - timedelta(days=7)
    week = db.query(models.Activity).filter(models.Activity.user_id == user.id, models.Activity.is_deleted.is_(False), models.Activity.started_at >= week_start)
    if sport:
        week = week.filter(models.Activity.sport == sport)
    week = week.all()
    return {'activities': items, 'next': items[-1]['started_at'] if len(rows) > limit else None,
            'last_7_days': {'count': len(week), 'distance_m': round(sum(r.distance_m for r in week), 1), 'moving_s': round(sum(r.moving_s for r in week), 1),
                            'elevation_gain_m': round(sum(r.elevation_gain_m for r in week), 1)}}


def get_activity(activity_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = db.get(models.Activity, activity_id)
    if not row or not can_view(db, user, row):
        raise HTTPException(status_code=404, detail='Activity not found.')
    return {'activity': detail(db, user, row)}


def edit(activity_id: str, data: ActivityEdit, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = owned(db, user, activity_id)
    for field in ('name', 'notes', 'visibility'):
        value = getattr(data, field)
        if value is not None:
            setattr(row, field, value.strip() if field == 'name' else value)
    db.commit()
    return {'activity': detail(db, user, row)}


def delete(activity_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = owned(db, user, activity_id)
    row.is_deleted = True
    row.route = []
    db.commit()


def records(sport: Sport = Query('run'), user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    return {'sport': sport, **bests(db, user.id, sport)}


def list_zones(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    return {'zones': [{'id': z.id, 'label': z.label, 'lat': z.lat, 'lon': z.lon, 'radius_m': z.radius_m} for z in zones_of(db, user.id)]}


def add_zone(data: ZoneInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    if len(zones_of(db, user.id)) >= MAX_ZONES:
        raise HTTPException(status_code=422, detail=f'Up to {MAX_ZONES} privacy zones.')
    zone = models.PrivacyZone(user_id=user.id, **data.model_dump())
    db.add(zone)
    db.commit()
    return list_zones(user, db)


def remove_zone(zone_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    zone = db.get(models.PrivacyZone, zone_id)
    if not zone or zone.user_id != user.id:
        raise HTTPException(status_code=404, detail='Privacy zone not found.')
    db.delete(zone)
    db.commit()
    return list_zones(user, db)
