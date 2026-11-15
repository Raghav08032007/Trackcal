"""Challenge progress from verified records only (Phase 10). Nothing here reads a number someone typed in.

Anti-fraud rules:
- Only records with server-set timestamps inside the challenge window count: workouts by `completed_at`, meals by
  `created_at` (so backdating a meal into the window doesn't help) and their `logged_at`, events by `checked_in_at`.
- Workouts must be completed sessions of at least 10 recorded minutes; at most 2 count per local day.
- Day-based metrics count distinct local days in the challenge's time zone.
- Nothing before the person joined, or after they left, counts.
- Distance comes only from GPS activities, measured on the server from the raw fixes, saved (`created_at`, server time) inside
  the window as well as started in it; at most KM_PER_DAY count per local day.
- Active minutes are GPS moving time plus completed workouts (at most 3 hours each); a run recorded inside a workout counts
  once; at most MINUTES_PER_DAY a local day. Hand-typed log entries never count.
- Camera sessions whose count was corrected by a large margin still count (people fix real mistakes), but mark the
  participation `flagged` for a moderator to look at. Flags never block XP or show publicly.
"""
import math
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import models

METRICS = {
    'active_days': 'Active days (a workout, a logged meal or an event)',
    'workouts': 'Workouts of 10+ minutes',
    'camera_workouts': 'Camera-tracked workouts of 10+ minutes',
    'camera_reps': 'Reps the camera counted',
    'meal_days': 'Days with a logged meal',
    'events': 'Verified events attended',
    'distance_km': 'Kilometres by GPS (walk, run, hike or ride)',
    'active_minutes': 'Active minutes (GPS activities and workouts)',
}
MIN_MINUTES, WORKOUTS_PER_DAY = 10, 2
REPS_PER_DAY = 500
KM_PER_DAY, MINUTES_PER_DAY, SESSION_MINUTES = 200, 300, 180


def camera_counted(details):
    """Reps the camera saw. A correction can lower the number, but typing a higher one adds nothing."""
    sets = ((details or {}).get('tracking') or {}).get('sets') or []
    total = 0
    for row in sets:
        if not isinstance(row, dict): continue
        seen, corrected = row.get('estimated_reps') or 0, row.get('corrected_reps')
        total += seen if corrected is None else min(seen, corrected)
    return total


def window(challenge):
    zone = ZoneInfo(challenge.timezone)
    start = datetime.combine(date.fromisoformat(challenge.starts_on), time.min, zone).astimezone(timezone.utc).replace(tzinfo=None)
    end = datetime.combine(date.fromisoformat(challenge.ends_on) + timedelta(days=1), time.min, zone).astimezone(timezone.utc).replace(tzinfo=None)
    return start, end


def _day(stamp, zone):
    return stamp.replace(tzinfo=timezone.utc).astimezone(zone).date()


def progress(db, challenge, participant):
    """Returns (count, flagged)."""
    zone = ZoneInfo(challenge.timezone); start, end = window(challenge)
    start = max(start, participant.joined_at)
    if participant.left_at: end = min(end, participant.left_at)
    uid = participant.user_id

    def workouts(camera_only):
        rows = db.query(models.WorkoutSession).filter(models.WorkoutSession.user_id == uid, models.WorkoutSession.status == 'completed',
                                                      models.WorkoutSession.is_deleted.is_(False), models.WorkoutSession.completed_at >= start,
                                                      models.WorkoutSession.completed_at < end, models.WorkoutSession.recorded_minutes >= MIN_MINUTES).all()
        rows = [r for r in rows if not camera_only or (r.details or {}).get('tracking_method') == 'camera']
        per_day, kept, flagged = Counter(), [], False
        for r in sorted(rows, key=lambda r: r.completed_at):
            d = _day(r.completed_at, zone)
            if per_day[d] >= WORKOUTS_PER_DAY: continue
            per_day[d] += 1; kept.append(d)
            flagged = flagged or bool(((r.details or {}).get('tracking') or {}).get('large_edit'))
        return kept, flagged

    def meal_days():
        rows = db.query(models.MealLog.logged_at).filter(models.MealLog.user_id == uid, models.MealLog.is_deleted.is_(False),
                                                         models.MealLog.created_at >= start, models.MealLog.created_at < end,
                                                         models.MealLog.logged_at >= start, models.MealLog.logged_at < end).all()
        return {_day(r[0], zone) for r in rows}

    def event_days():
        rows = db.query(models.EventRegistration.checked_in_at).filter(models.EventRegistration.user_id == uid, models.EventRegistration.checked_in_at >= start,
                                                                      models.EventRegistration.checked_in_at < end).all()
        return [_day(r[0], zone) for r in rows]

    def camera_reps():
        rows = db.query(models.WorkoutSession).filter(models.WorkoutSession.user_id == uid, models.WorkoutSession.status == 'completed',
                                                      models.WorkoutSession.is_deleted.is_(False), models.WorkoutSession.completed_at >= start,
                                                      models.WorkoutSession.completed_at < end).all()
        per_day, flagged = Counter(), False
        for r in rows:
            if (r.details or {}).get('tracking_method') != 'camera': continue
            per_day[_day(r.completed_at, zone)] += camera_counted(r.details)
            flagged = flagged or bool(((r.details or {}).get('tracking') or {}).get('large_edit'))
        return sum(min(REPS_PER_DAY, reps) for reps in per_day.values()), flagged

    def activities():
        return db.query(models.Activity).filter(models.Activity.user_id == uid, models.Activity.is_deleted.is_(False),
                                                models.Activity.started_at >= start, models.Activity.started_at < end,
                                                models.Activity.created_at >= start, models.Activity.created_at < end).all()

    def distance_km():
        per_day = Counter()
        for a in activities():
            per_day[_day(a.started_at, zone)] += (a.distance_m or 0) / 1000
        return math.floor(sum(min(KM_PER_DAY, km) for km in per_day.values()) * 10) / 10   # to 0.1 km, rounded down: never finishes early

    def active_minutes():
        per_day, linked = Counter(), set()
        for a in activities():
            if a.session_id: linked.add(a.session_id)
            per_day[_day(a.started_at, zone)] += min(SESSION_MINUTES, (a.moving_s or 0) / 60)
        for r in db.query(models.WorkoutSession).filter(models.WorkoutSession.user_id == uid, models.WorkoutSession.status == 'completed',
                                                        models.WorkoutSession.is_deleted.is_(False), models.WorkoutSession.completed_at >= start,
                                                        models.WorkoutSession.completed_at < end).all():
            if r.id in linked: continue
            per_day[_day(r.completed_at, zone)] += min(SESSION_MINUTES, r.recorded_minutes or 0)
        return int(sum(min(MINUTES_PER_DAY, m) for m in per_day.values()))

    m = challenge.metric
    if m == 'distance_km': return distance_km(), False
    if m == 'active_minutes': return active_minutes(), False
    if m == 'camera_reps': return camera_reps()
    if m in ('workouts', 'camera_workouts'):
        kept, flagged = workouts(m == 'camera_workouts'); return len(kept), flagged
    if m == 'meal_days': return len(meal_days()), False
    if m == 'events': return len(event_days()), False
    kept, flagged = workouts(False)
    return len(set(kept) | meal_days() | set(event_days())), flagged
