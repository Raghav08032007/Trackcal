"""Verified events (Phase 9, flag `verified_events`; uses feed profiles, so `social_feed` too).

- Anyone with a feed profile can organize up to 10 upcoming events; community events need a community owner or
  moderator, and private-community events are visible to members only.
- Registration: 'going' up to capacity, then 'waitlist'; a cancellation promotes the oldest waitlisted person.
- Check-in (from 30 minutes before the start until the end): the organizer shows a QR code that changes every
  30 seconds. It encodes /events/<id>/check-in?t=<token>; a token is an HMAC of the event's secret key and the
  30-second window, accepted for the current or previous window only, so a forwarded screenshot soon stops working.
  The organizer can also check in a registered person by hand. Nobody can check themselves in as the organizer.
- A verified check-in pays the `verified_event_attendance` XP rule once per event (ledger-idempotent).
Attendee lists are visible to the organizer only; others see counts."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends, HTTPException, Query
from routers import communities, social
from routers.auth import get_current_active_user
from services import gamification, notifications
from services.abuse_limits import consume
from services.feature_flags import is_enabled
from timeutil import utcnow

WINDOW_SECONDS, EARLY_MINUTES, MAX_UPCOMING = 30, 30, 10
CATEGORIES = communities.CATEGORIES


def require_flags(db):
    if not (is_enabled(db, 'verified_events') and is_enabled(db, 'social_feed')): raise HTTPException(404, 'Events are not available yet.')


def token_for(event, window):
    return hmac.new(event.checkin_key.encode(), f'{event.id}:{window}'.encode(), hashlib.sha256).hexdigest()[:20]


def current_window(now=None):
    stamp = (now or utcnow()).replace(tzinfo=timezone.utc).timestamp()
    return int(stamp // WINDOW_SECONDS)


def check_in_open(event, now=None):
    now = now or utcnow()
    return event.status == 'scheduled' and event.starts_at - timedelta(minutes=EARLY_MINUTES) <= now <= event.ends_at


def get_event(db, event_id, viewer_id, lock=False):
    query = db.query(models.Event).filter_by(id=str(event_id))
    row = (query.with_for_update() if lock else query).first()
    if not row or not can_view(db, viewer_id, row): raise HTTPException(404, 'Event not found.')
    return row


def can_view(db, viewer_id, event):
    if event.organizer_id == str(viewer_id): return True
    if event.status == 'hidden' or social.blocks_between(db, str(viewer_id), event.organizer_id): return False
    return not event.community_id or social.community_access(db, viewer_id, event.community_id)


def utc_text(value):
    return value.isoformat() + 'Z' if value else None


def view(db, event, viewer_id):
    counts = dict(db.query(models.EventRegistration.status, func.count()).filter_by(event_id=event.id).group_by(models.EventRegistration.status).all())
    mine = db.get(models.EventRegistration, (event.id, str(viewer_id)))
    organizer = social.profile_of(db, event.organizer_id)
    community = db.get(models.Community, event.community_id) if event.community_id else None
    return {'id': event.id, 'title': event.title, 'description': event.description, 'category': event.category, 'location': event.location,
            'starts_at': utc_text(event.starts_at), 'ends_at': utc_text(event.ends_at), 'timezone': event.timezone, 'capacity': event.capacity,
            'status': event.status, 'hidden': event.status == 'hidden', 'going': counts.get('going', 0), 'waitlist': counts.get('waitlist', 0),
            'organizer': {'handle': organizer.handle, 'display_name': organizer.display_name, 'character_id': organizer.character_id} if organizer else None,
            'community': {'slug': community.slug, 'name': community.name} if community else None,
            'mine': {'status': mine.status, 'checked_in': bool(mine.checked_in_at)} if mine else None,
            'organizing': event.organizer_id == str(viewer_id), 'check_in_open': check_in_open(event)}


class EventInput(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default='', max_length=1000)
    category: Literal[CATEGORIES] = 'other'  # type: ignore[valid-type]
    location: str = Field(min_length=3, max_length=200)
    starts_at: datetime
    minutes: int = Field(ge=15, le=720)
    timezone: str = Field(default='UTC', max_length=64)
    capacity: int | None = Field(default=None, ge=2, le=500)
    community: str | None = Field(default=None, max_length=40)

    @field_validator('title', 'description', 'location')
    @classmethod
    def tidy(cls, value): return value.strip()

    @field_validator('timezone')
    @classmethod
    def zone(cls, value):
        try: ZoneInfo(value)
        except Exception: raise ValueError('Choose a valid time zone.')
        return value


def listing(scope: str = Query('upcoming', pattern=r'^(upcoming|mine)$'), community: str | None = Query(None, max_length=40),
            user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); now = utcnow()
    query = db.query(models.Event).filter(models.Event.ends_at >= now)
    if scope == 'mine':
        mine = db.query(models.EventRegistration.event_id).filter(models.EventRegistration.user_id == user.id, models.EventRegistration.status != 'cancelled')
        query = query.filter((models.Event.organizer_id == user.id) | models.Event.id.in_(mine))
    else:
        query = query.filter(models.Event.status == 'scheduled')
    if community:
        query = query.filter(models.Event.community_id == communities.by_slug(db, community).id)
    rows = [e for e in query.order_by(models.Event.starts_at).limit(200).all() if can_view(db, user.id, e)][:50]
    return {'events': [view(db, e, user.id) for e in rows]}


def create(data: EventInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); social.require_can_publish(db, user)
    starts = (data.starts_at.astimezone(timezone.utc) if data.starts_at.tzinfo else data.starts_at.replace(tzinfo=ZoneInfo(data.timezone)).astimezone(timezone.utc)).replace(tzinfo=None)
    now = utcnow()
    if not now + timedelta(minutes=10) <= starts <= now + timedelta(days=180): raise HTTPException(422, 'Events start between 10 minutes and 180 days from now.')
    community_id = None
    if data.community:
        c = communities.by_slug(db, data.community)
        member = db.get(models.CommunityMember, (c.id, user.id))
        if not member or member.status != 'active' or member.role not in ('owner', 'moderator'): raise HTTPException(403, "Only the community's owner or moderators can add its events.")
        community_id = c.id
    db.query(models.User).filter_by(id=user.id).with_for_update().one()
    if db.query(func.count(models.Event.id)).filter(models.Event.organizer_id == user.id, models.Event.ends_at >= now, models.Event.status == 'scheduled').scalar() >= MAX_UPCOMING:
        raise HTTPException(409, f'You can have up to {MAX_UPCOMING} upcoming events.')
    consume(db, 'event-create', str(user.id), 20, 86400)
    event = models.Event(organizer_id=user.id, community_id=community_id, title=data.title, description=data.description, category=data.category,
                         location=data.location, starts_at=starts, ends_at=starts + timedelta(minutes=data.minutes), timezone=data.timezone,
                         capacity=data.capacity, checkin_key=secrets.token_hex(32))
    db.add(event); db.commit()
    return {'event': view(db, event, user.id)}


def detail(event_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); return {'event': view(db, get_event(db, event_id, user.id), user.id)}


def cancel_event(event_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); event = get_event(db, event_id, user.id, lock=True)
    if event.organizer_id != user.id: raise HTTPException(403, 'Only the organizer can cancel this event.')
    if event.status != 'cancelled': notifications.notify_event_change(db, event.id, 'cancelled')
    event.status = 'cancelled'; db.commit()
    return {'event': view(db, event, user.id)}


def register(event_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); social.my_profile(db, user); consume(db, 'event-register', str(user.id), 60, 3600)
    event = get_event(db, event_id, user.id, lock=True)  # the lock serialises seat counting
    if event.status != 'scheduled' or event.ends_at <= utcnow(): raise HTTPException(409, 'This event is no longer taking sign-ups.')
    if event.organizer_id == user.id: raise HTTPException(409, "You're organizing this event.")
    row = db.get(models.EventRegistration, (event.id, user.id))
    if row and row.status != 'cancelled': return {'event': view(db, event, user.id)}
    going = db.query(func.count()).select_from(models.EventRegistration).filter_by(event_id=event.id, status='going').scalar()
    status = 'waitlist' if event.capacity and going >= event.capacity else 'going'
    if row: row.status, row.created_at = status, utcnow()
    else: db.add(models.EventRegistration(event_id=event.id, user_id=user.id, status=status))
    db.commit()
    return {'event': view(db, event, user.id)}


def unregister(event_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); event = get_event(db, event_id, user.id, lock=True)
    row = db.get(models.EventRegistration, (event.id, user.id))
    if row and row.status != 'cancelled':
        if row.checked_in_at: raise HTTPException(409, "You've already checked in to this event.")
        was_going = row.status == 'going'; row.status = 'cancelled'
        if was_going:
            nxt = db.query(models.EventRegistration).filter_by(event_id=event.id, status='waitlist').order_by(models.EventRegistration.created_at).first()
            if nxt: nxt.status = 'going'
    db.commit()
    return {'event': view(db, event, user.id)}


def attendees(event_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); event = get_event(db, event_id, user.id)
    if event.organizer_id != user.id: raise HTTPException(403, 'Only the organizer can see who is coming.')
    rows = db.query(models.EventRegistration).filter(models.EventRegistration.event_id == event.id, models.EventRegistration.status != 'cancelled').order_by(models.EventRegistration.created_at).all()
    out = []
    for r in rows:
        p = social.profile_of(db, r.user_id)
        out.append({'handle': p.handle if p else '', 'display_name': p.display_name if p else 'Member', 'status': r.status, 'checked_in': bool(r.checked_in_at), 'method': r.check_in_method})
    return {'attendees': out}


def check_in_code(event_id: str, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    """The organizer's screen polls this. The token in the QR code changes every 30 seconds."""
    require_flags(db); event = get_event(db, event_id, user.id)
    if event.organizer_id != user.id: raise HTTPException(403, 'Only the organizer can show the check-in code.')
    if not check_in_open(event): raise HTTPException(409, f'Check-in opens {EARLY_MINUTES} minutes before the start and closes at the end.')
    window = current_window(); stamp = utcnow().replace(tzinfo=timezone.utc).timestamp()
    return {'token': token_for(event, window), 'path': f'/events/{event.id}/check-in', 'refresh_in': int(WINDOW_SECONDS - stamp % WINDOW_SECONDS) + 1,
            'checked_in': db.query(func.count()).select_from(models.EventRegistration).filter(models.EventRegistration.event_id == event.id, models.EventRegistration.checked_in_at.isnot(None)).scalar()}


class CheckIn(BaseModel):
    token: str | None = Field(default=None, min_length=8, max_length=40)
    handle: str | None = Field(default=None, max_length=30)  # organizer checking someone in by hand


def _verify(db, event, person_id, method, now):
    row = db.query(models.EventRegistration).filter_by(event_id=event.id, user_id=person_id).with_for_update().first()
    if not row or row.status == 'cancelled': raise HTTPException(409, 'Sign up for this event first.')
    if row.status == 'waitlist': raise HTTPException(409, "You're on the waitlist for this event, so check-in isn't open to you.")
    if row.checked_in_at: return row, 0
    row.checked_in_at, row.check_in_method = now, method
    person = db.get(models.User, person_id)
    profile = db.get(models.AdventureProfile, person_id)
    day = now.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(profile.timezone)).date() if profile else now.date()
    points = gamification.award(db, person, 'verified_event_attendance', day, source_id=f'event:{event.id}', payload={'method': method}) if profile else 0
    return row, points


def check_in(event_id: str, data: CheckIn, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flags(db); consume(db, 'event-check-in', str(user.id), 30, 3600)
    event = get_event(db, event_id, user.id, lock=True); now = utcnow()
    if not check_in_open(event, now): raise HTTPException(409, f'Check-in opens {EARLY_MINUTES} minutes before the start and closes at the end.')
    if data.handle:  # organizer, by hand
        if event.organizer_id != user.id: raise HTTPException(403, 'Only the organizer can check people in.')
        target = db.query(models.SocialProfile).filter_by(handle=data.handle.lower()).first()
        if not target: raise HTTPException(404, 'No one with that handle.')
        if target.user_id == user.id: raise HTTPException(409, "Organizers can't check themselves in.")
        row, points = _verify(db, event, target.user_id, 'organizer', now)
    else:
        if event.organizer_id == user.id: raise HTTPException(409, "Organizers can't check themselves in.")
        window = current_window(now)
        if not data.token or not any(hmac.compare_digest(data.token.encode(), token_for(event, w).encode()) for w in (window, window - 1)):
            raise HTTPException(403, 'This code has expired. Scan the code on the organizer\'s screen again.')
        row, points = _verify(db, event, user.id, 'qr', now)
    db.commit()
    return {'status': 'checked_in', 'awarded_xp': points, 'checked_in_at': utc_text(row.checked_in_at), 'event': view(db, event, user.id)}
