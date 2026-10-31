"""Verified challenges (Phase 10, flag `verified_challenges`; uses feed profiles, so `social_feed` too).

Anyone with a feed profile can start up to 5 running challenges; community challenges need the community's owner or a
moderator, and private-community challenges are visible to members only. A challenge is a metric, a target and a date
range (3–60 days) in a time zone. Progress comes from services/challenge_progress.py, never from the client.
Reaching the target pays the `verified_challenge_completion` XP rule once per challenge. There is no leaderboard:
people see their own progress and how many finished, not a ranking (wellness ethics)."""
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends, HTTPException, Query
from routers import communities, social
from routers.auth import get_current_active_user
from services import gamification
from services.abuse_limits import consume
from services.challenge_progress import METRICS, progress
from services.feature_flags import is_enabled
from timeutil import utcnow

MAX_RUNNING, MIN_DAYS, MAX_DAYS = 5, 3, 60


def require_flags(db):
    if not (is_enabled(db, 'verified_challenges') and is_enabled(db, 'social_feed')): raise HTTPException(404, 'Challenges are not available yet.')


def can_view(db, viewer_id, c):
    if c.creator_id == str(viewer_id): return True
    if social.blocks_between(db, str(viewer_id), c.creator_id): return False
    return not c.community_id or social.community_access(db, viewer_id, c.community_id)


def get_challenge(db, cid, viewer_id):
    c = db.get(models.Challenge, str(cid))
    if not c or not can_view(db, viewer_id, c): raise HTTPException(404, 'Challenge not found.')
    return c


def today_in(zone):
    return datetime.now(ZoneInfo(zone)).date()


def phase(c):
    t = today_in(c.timezone)
    if c.status == 'cancelled': return 'cancelled'
    return 'upcoming' if t < date.fromisoformat(c.starts_on) else 'ended' if t > date.fromisoformat(c.ends_on) else 'running'


def settle(db, c, row):
    """Compute progress; on reaching the target, complete and pay XP once. Returns (count, awarded_xp)."""
    count, flagged = progress(db, c, row); points = 0
    if flagged and not row.flagged: row.flagged = True
    if count >= c.target and not row.completed_at and not row.left_at and c.status == 'active':
        row.completed_at = utcnow()
        user = db.get(models.User, row.user_id); profile = db.get(models.AdventureProfile, row.user_id)
        if profile:
            day = datetime.now(ZoneInfo(profile.timezone)).date()
            points = gamification.award(db, user, 'verified_challenge_completion', day, source_id=f'challenge:{c.id}', payload={'metric': c.metric})
    return count, points


def view(db, c, viewer_id, mine_progress=None):
    active = db.query(models.ChallengeParticipant).filter(models.ChallengeParticipant.challenge_id == c.id, models.ChallengeParticipant.left_at.is_(None))
    creator = social.profile_of(db, c.creator_id); community = db.get(models.Community, c.community_id) if c.community_id else None
    row = db.get(models.ChallengeParticipant, (c.id, str(viewer_id)))
    mine = None
    if row and not row.left_at:
        mine = {'progress': min(mine_progress if mine_progress is not None else progress(db, c, row)[0], c.target), 'completed': bool(row.completed_at)}
    return {'id': c.id, 'title': c.title, 'description': c.description, 'metric': c.metric, 'metric_label': METRICS[c.metric], 'target': c.target,
            'starts_on': c.starts_on, 'ends_on': c.ends_on, 'timezone': c.timezone, 'phase': phase(c),
            'participants': active.count(), 'finished': active.filter(models.ChallengeParticipant.completed_at.isnot(None)).count(),
            'creator': {'handle': creator.handle, 'display_name': creator.display_name} if creator else None,
            'community': {'slug': community.slug, 'name': community.name} if community else None, 'mine': mine, 'created_by_me': c.creator_id == str(viewer_id)}


class ChallengeInput(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default='', max_length=1000)
    metric: Literal[tuple(METRICS)]  # type: ignore[valid-type]
    target: int = Field(ge=1, le=120)
    starts_on: date
    ends_on: date
    timezone: str = Field(default='UTC', max_length=64)
    community: str | None = Field(default=None, max_length=40)

    @field_validator('title', 'description')
    @classmethod
    def tidy(cls, v): return v.strip()

    @field_validator('timezone')
    @classmethod
    def zone(cls, v):
        try: ZoneInfo(v)
        except Exception: raise ValueError('Choose a valid time zone.')
        return v

    @model_validator(mode='after')
    def sensible(self):
        days = (self.ends_on - self.starts_on).days + 1
        if not MIN_DAYS <= days <= MAX_DAYS: raise ValueError(f'Challenges last {MIN_DAYS} to {MAX_DAYS} days.')
        limit = {'workouts': days * 2, 'camera_workouts': days * 2, 'events': min(30, days)}.get(self.metric, days)
        if self.target > limit: raise ValueError(f'That target is more than this challenge can count in {days} days (at most {limit}).')
        return self


def listing(scope: str = Query('open', pattern=r'^(open|mine)$'), community: str | None = Query(None, max_length=40),
            user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db)
    query = db.query(models.Challenge).filter(models.Challenge.status == 'active')
    if scope == 'mine':
        joined = db.query(models.ChallengeParticipant.challenge_id).filter(models.ChallengeParticipant.user_id == user.id, models.ChallengeParticipant.left_at.is_(None))
        query = db.query(models.Challenge).filter((models.Challenge.creator_id == user.id) | models.Challenge.id.in_(joined))
    if community: query = query.filter(models.Challenge.community_id == communities.by_slug(db, community).id)
    rows = [c for c in query.order_by(models.Challenge.starts_on.desc()).limit(200).all() if can_view(db, user.id, c) and (scope == 'mine' or phase(c) != 'ended')][:50]
    return {'challenges': [view(db, c, user.id) for c in rows]}


def create(data: ChallengeInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); social.my_profile(db, user)
    t = today_in(data.timezone)
    if not t <= data.starts_on <= t + timedelta(days=90): raise HTTPException(422, 'Challenges start today or within the next 90 days.')
    community_id = None
    if data.community:
        c = communities.by_slug(db, data.community); m = db.get(models.CommunityMember, (c.id, user.id))
        if not m or m.status != 'active' or m.role not in ('owner', 'moderator'): raise HTTPException(403, "Only the community's owner or moderators can add its challenges.")
        community_id = c.id
    db.query(models.User).filter_by(id=user.id).with_for_update().one()
    running = [x for x in db.query(models.Challenge).filter_by(creator_id=user.id, status='active').all() if phase(x) != 'ended']
    if len(running) >= MAX_RUNNING: raise HTTPException(409, f'You can run up to {MAX_RUNNING} challenges at a time.')
    consume(db, 'challenge-create', str(user.id), 20, 86400)
    c = models.Challenge(creator_id=user.id, community_id=community_id, title=data.title, description=data.description, metric=data.metric,
                         target=data.target, starts_on=str(data.starts_on), ends_on=str(data.ends_on), timezone=data.timezone)
    db.add(c); db.flush()
    db.add(models.ChallengeParticipant(challenge_id=c.id, user_id=user.id)); db.commit()  # creators take part too
    return {'challenge': view(db, c, user.id)}


def detail(challenge_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """Also settles the viewer's progress: reaching the target completes the challenge and pays XP once."""
    require_flags(db); c = get_challenge(db, challenge_id, user.id)
    row = db.query(models.ChallengeParticipant).filter_by(challenge_id=c.id, user_id=user.id).with_for_update().first()
    count, points = settle(db, c, row) if row and not row.left_at else (None, 0)
    db.commit()
    return {'challenge': view(db, c, user.id, count), 'awarded_xp': points}


def join(challenge_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); social.my_profile(db, user); consume(db, 'challenge-join', str(user.id), 60, 3600)
    c = get_challenge(db, challenge_id, user.id)
    db.query(models.User).filter_by(id=user.id).with_for_update().one()  # a double tap must not insert two rows
    if c.status != 'active' or phase(c) == 'ended': raise HTTPException(409, 'This challenge has finished.')
    row = db.get(models.ChallengeParticipant, (c.id, user.id))
    if row and row.left_at: raise HTTPException(409, "You left this challenge, so you can't rejoin it.")
    if not row: db.add(models.ChallengeParticipant(challenge_id=c.id, user_id=user.id))
    db.commit()
    return {'challenge': view(db, c, user.id)}


def leave(challenge_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); c = get_challenge(db, challenge_id, user.id)
    row = db.get(models.ChallengeParticipant, (c.id, user.id))
    if row and not row.left_at: row.left_at = utcnow()
    db.commit()
    return {'challenge': view(db, c, user.id)}


def cancel(challenge_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); c = get_challenge(db, challenge_id, user.id)
    if c.creator_id != user.id: raise HTTPException(403, 'Only the person who started this challenge can cancel it.')
    c.status = 'cancelled'; db.commit()
    return {'challenge': view(db, c, user.id)}
