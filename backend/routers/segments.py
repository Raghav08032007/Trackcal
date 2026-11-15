"""Segments (Phase G): make one from a stretch of your own activity, see every pass you've made along it, and, if you opt in, a ranking
among people who also opted in and follow each other. No public ranking of strangers (the app's wellness rule for challenges, kept).

Privacy: a public segment never touches the creator's privacy zones or the hidden 200 m at either end of the route it came from; a
private one is seen by its creator only. Efforts in a ranking come only from activities the viewer may see, and blocks hide both ways."""
from datetime import timedelta
from typing import Literal, Optional

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends, HTTPException, Query
from routers.activities import SHARED_END_HIDDEN_M, can_view, owned, zones_of
from routers.auth import get_current_active_user
from routers.social import blocks_between, follows, profile_of
from services import segments as seg
from services.abuse_limits import consume
from timeutil import utcnow

MAX_SEGMENTS = 50
MATCH_LIMIT = 200


class SegmentInput(BaseModel):
    activity_id: str = Field(min_length=36, max_length=36)
    name: str = Field(min_length=1, max_length=60)
    start_m: float = Field(ge=0)
    end_m: float = Field(gt=0)
    visibility: Literal['public', 'private'] = 'public'


class SettingInput(BaseModel):
    ranking: bool


def visible(db, viewer_id, row):
    return row and not row.is_deleted and (row.visibility == 'public' or row.creator_id == viewer_id)


def ranking_on(db, user_id):
    s = db.get(models.SegmentSetting, user_id)
    return bool(s and s.ranking)


def record_efforts(db, segment, activity):
    """Time every pass of this activity along this segment; a pass already stored isn't stored twice."""
    if seg.KIND.get(activity.sport) != segment.kind or activity.is_deleted:
        return 0
    added = 0
    for start_s, elapsed in seg.efforts(segment.points, segment.distance_m, activity.route or []):
        at = activity.started_at + timedelta(seconds=start_s or 0)
        exists = db.query(models.SegmentEffort.id).filter_by(activity_id=activity.id, segment_id=segment.id, started_at=at).first()
        if not exists:
            db.add(models.SegmentEffort(segment_id=segment.id, activity_id=activity.id, user_id=activity.user_id, elapsed_s=elapsed, started_at=at))
            added += 1
    return added


def match_activity(db, activity):
    """On saving an activity: every segment near its route that its owner may see (public ones, and their own private ones)."""
    route = activity.route or []
    if len(route) < 2:
        return
    lo_lat, hi_lat, lo_lon, hi_lon = seg.box(route)
    # The box is padded by about 100 m: a pass may run up to REACH_M off the line, and the stored box is single precision
    # (48.85 reads back as 48.849998), so a perfectly straight street would otherwise miss its own box.
    pad = 0.001
    lo_lat, hi_lat, lo_lon, hi_lon = lo_lat - pad, hi_lat + pad, lo_lon - pad, hi_lon + pad
    near = db.query(models.Segment).filter(models.Segment.is_deleted.is_(False), models.Segment.kind == seg.KIND.get(activity.sport),
                                           models.Segment.min_lat <= hi_lat, models.Segment.max_lat >= lo_lat,
                                           models.Segment.min_lon <= hi_lon, models.Segment.max_lon >= lo_lon).limit(MATCH_LIMIT).all()
    for s in near:
        if visible(db, activity.user_id, s):
            record_efforts(db, s, activity)


def friends(db, user_id):
    """People this person follows and who follow them back, both opted in to rankings, with no block between them."""
    out = []
    for f in db.query(models.Follow).filter(models.Follow.follower_id == user_id, models.Follow.status == 'active').limit(500):
        other = f.followee_id
        if follows(db, other, user_id) == 'active' and ranking_on(db, other) and not blocks_between(db, user_id, other):
            out.append(other)
    return out


def view(db, viewer, s, with_points=True):
    mine = db.query(models.SegmentEffort).join(models.Activity, models.Activity.id == models.SegmentEffort.activity_id) \
        .filter(models.SegmentEffort.segment_id == s.id, models.SegmentEffort.user_id == viewer.id, models.Activity.is_deleted.is_(False)) \
        .order_by(models.SegmentEffort.elapsed_s).all()
    data = {'id': s.id, 'name': s.name, 'kind': s.kind, 'visibility': s.visibility, 'distance_m': round(s.distance_m, 1), 'mine': s.creator_id == viewer.id,
            'best': {'elapsed_s': mine[0].elapsed_s, 'date': mine[0].started_at.date().isoformat(), 'activity_id': mine[0].activity_id} if mine else None,
            'attempts': len(mine),
            'history': [{'elapsed_s': e.elapsed_s, 'date': e.started_at.date().isoformat(), 'activity_id': e.activity_id}
                        for e in sorted(mine, key=lambda e: e.started_at, reverse=True)[:20]]}
    if with_points:
        data['points'] = s.points
    opted = ranking_on(db, viewer.id)
    data['ranking'] = {'opted_in': opted, 'entries': ranking(db, viewer, s) if opted and s.visibility == 'public' else []}
    return data


def ranking(db, viewer, s):
    people = [viewer.id] + friends(db, viewer.id)
    rows = db.query(models.SegmentEffort, models.Activity).join(models.Activity, models.Activity.id == models.SegmentEffort.activity_id) \
        .filter(models.SegmentEffort.segment_id == s.id, models.SegmentEffort.user_id.in_(people), models.Activity.is_deleted.is_(False)).all()
    best = {}
    for effort, activity in rows:
        if effort.user_id != viewer.id and not can_view(db, viewer, activity):
            continue
        if effort.user_id not in best or effort.elapsed_s < best[effort.user_id].elapsed_s:
            best[effort.user_id] = effort
    out = []
    for place, e in enumerate(sorted(best.values(), key=lambda e: e.elapsed_s), start=1):
        p = profile_of(db, e.user_id)
        out.append({'place': place, 'me': e.user_id == viewer.id, 'elapsed_s': e.elapsed_s, 'date': e.started_at.date().isoformat(),
                    'handle': p.handle if p else None, 'display_name': p.display_name if p else 'You', 'character_id': p.character_id if p else 'pip'})
    return out


def create_segment(data: SegmentInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    consume(db, 'segment-create', str(user.id), 20, 86400)
    activity = owned(db, user, data.activity_id)
    if db.query(models.Segment).filter_by(creator_id=user.id, is_deleted=False).count() >= MAX_SEGMENTS:
        raise HTTPException(status_code=422, detail=f'Up to {MAX_SEGMENTS} segments each.')
    if data.end_m > activity.distance_m + 1 or data.end_m <= data.start_m:
        raise HTTPException(status_code=422, detail='Pick a stretch within this activity, with the end after the start.')
    points = seg.cut(activity.route or [], data.start_m, data.end_m)
    distance = seg.length(points)
    if not seg.MIN_LENGTH_M <= distance <= seg.MAX_LENGTH_M:
        raise HTTPException(status_code=422, detail='A segment is between 200 m and 50 km long.')
    if data.visibility == 'public':
        route = activity.route
        circles = [(route[0][0], route[0][1], SHARED_END_HIDDEN_M), (route[-1][0], route[-1][1], SHARED_END_HIDDEN_M)]
        circles += [(z.lat, z.lon, z.radius_m) for z in zones_of(db, user.id)]
        if seg.touches(points, circles):
            raise HTTPException(status_code=422, detail='A public segment can’t include a privacy zone or the first and last 200 m of your route. '
                                                        'Pick a stretch further along, or make it private.')
    lo_lat, hi_lat, lo_lon, hi_lon = seg.box(points)
    row = models.Segment(creator_id=user.id, name=data.name.strip(), kind=seg.KIND[activity.sport], visibility=data.visibility, points=points,
                         distance_m=distance, min_lat=lo_lat, max_lat=hi_lat, min_lon=lo_lon, max_lon=hi_lon)
    db.add(row)
    db.flush()
    # Time it on the creator's recent activities, and on those of friends in the ranking (a public segment only).
    people = [user.id] + (friends(db, user.id) if data.visibility == 'public' else [])
    since = utcnow() - timedelta(days=90)
    for a in db.query(models.Activity).filter(models.Activity.user_id.in_(people), models.Activity.is_deleted.is_(False),
                                              models.Activity.started_at >= since).order_by(models.Activity.started_at.desc()).limit(MATCH_LIMIT):
        record_efforts(db, row, a)
    db.commit()
    return {'segment': view(db, user, row)}


def get_segment(segment_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = db.get(models.Segment, segment_id)
    if not visible(db, user.id, row):
        raise HTTPException(status_code=404, detail='Segment not found.')
    return {'segment': view(db, user, row)}


def list_segments(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Segments you made or have been timed on, with your best on each."""
    ids = {sid for (sid,) in db.query(models.SegmentEffort.segment_id).filter(models.SegmentEffort.user_id == user.id).distinct()}
    ids |= {sid for (sid,) in db.query(models.Segment.id).filter(models.Segment.creator_id == user.id)}
    rows = [r for r in db.query(models.Segment).filter(models.Segment.id.in_(ids or [''])).all() if visible(db, user.id, r)]
    items = [view(db, user, r, with_points=False) for r in rows]
    for item in items:
        item.pop('history', None)
    return {'segments': sorted(items, key=lambda s: s['name'].lower()), 'ranking': ranking_on(db, user.id)}


def delete_segment(segment_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = db.get(models.Segment, segment_id)
    if not row or row.is_deleted or row.creator_id != user.id:
        raise HTTPException(status_code=404, detail='Segment not found.')
    row.is_deleted = True
    db.commit()


def get_setting(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    return {'ranking': ranking_on(db, user.id)}


def save_setting(data: SettingInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    row = db.get(models.SegmentSetting, user.id) or models.SegmentSetting(user_id=user.id)
    row.ranking, row.updated_at = data.ranking, utcnow()
    db.merge(row)
    db.commit()
    return {'ranking': data.ranking}


def for_activity(db, viewer, activity, with_history=False):
    """The segments this activity was timed on, each with where the pass sits among the owner's own times (1 = their best)."""
    out = []
    for e in db.query(models.SegmentEffort).filter(models.SegmentEffort.activity_id == activity.id).order_by(models.SegmentEffort.started_at):
        s = db.get(models.Segment, e.segment_id)
        if not visible(db, viewer.id, s):
            continue
        faster = db.query(models.SegmentEffort).join(models.Activity, models.Activity.id == models.SegmentEffort.activity_id) \
            .filter(models.SegmentEffort.segment_id == s.id, models.SegmentEffort.user_id == activity.user_id, models.Activity.is_deleted.is_(False),
                    models.SegmentEffort.id != e.id, models.SegmentEffort.elapsed_s < e.elapsed_s - 0.05).count()   # times are stored as single-precision floats
        row = {'segment_id': s.id, 'name': s.name, 'distance_m': round(s.distance_m, 1), 'elapsed_s': e.elapsed_s, 'place': faster + 1}
        if with_history:   # earlier passes by the same person: a first pass is a time, not yet a record
            row['attempts_before'] = db.query(models.SegmentEffort).filter(models.SegmentEffort.segment_id == s.id, models.SegmentEffort.user_id == activity.user_id,
                                                                           models.SegmentEffort.started_at < e.started_at).count()
        out.append(row)
    return out
