"""GET /api/v1/wellness/trend: the last 12 weeks of activity and the fitness trend (services/training_load.py).

Counts completed workouts, GPS activities and hand-logged workouts, by the person's own calendar day. A GPS activity recorded as part
of a workout is counted once, as the activity (its speed gives a truer effort than the workout's type). Totals only: no routes."""
from datetime import date, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends, Query
from routers.auth import get_current_active_user
from routers.personalization import local_now, prefs_for
from routers.training import CATEGORIES
from services import training_load as tl


def trend(weeks: int = Query(12, ge=4, le=26), user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    prefs = prefs_for(db.get(models.PersonalizationProfile, user.id))
    zone, today = ZoneInfo(prefs.timezone), local_now(prefs).date()
    since = today - timedelta(weeks=weeks) - timedelta(days=tl.FITNESS_DAYS * 2 + 7)
    since_utc = (since - timedelta(days=1)).isoformat()
    local = lambda at: at.replace(tzinfo=timezone.utc).astimezone(zone).date()
    items, linked = [], set()
    for a in db.query(models.Activity).filter(models.Activity.user_id == user.id, models.Activity.is_deleted.is_(False),
                                              models.Activity.started_at >= since_utc):
        if a.session_id:
            linked.add(a.session_id)
        items.append((local(a.started_at), a.moving_s / 60, tl.activity_met(a.sport, a.distance_m, a.moving_s),
                      'walk' if a.sport == 'hike' else a.sport, a.distance_m))
    for s in db.query(models.WorkoutSession).filter(models.WorkoutSession.user_id == user.id, models.WorkoutSession.is_deleted.is_(False),
                                                    models.WorkoutSession.status == 'completed', models.WorkoutSession.completed_at >= since_utc):
        if s.id in linked:
            continue
        met, kind = tl.session_met(s.details, CATEGORIES)
        items.append((local(s.completed_at), s.recorded_minutes or s.active_seconds / 60, met, kind, 0))
    for e in db.query(models.WorkoutEntry).filter(models.WorkoutEntry.user_id == user.id, models.WorkoutEntry.is_deleted.is_(False),
                                                  models.WorkoutEntry.day >= since.isoformat()):
        met, kind = tl.entry_met(e.name)
        try:
            day = date.fromisoformat(e.day)
        except ValueError:
            continue
        items.append((day, e.minutes, met, kind, 0))
    return {**tl.summarise(items, today, weeks), 'method': 'Minutes × METs (Compendium of Physical Activities). WHO: 600–1,200 MET-minutes a week. '
                                                         'Fitness and fatigue are 42- and 7-day weighted averages of daily effort. Estimates, not a medical assessment.'}
