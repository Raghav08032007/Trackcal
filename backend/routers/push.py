"""Web push: public key, per-device subscriptions, preferences and open tracking (Phase 4, flag `web_push`).
Time zone and quiet hours stay in the existing personalization preferences; this router only adds the push channel."""
from datetime import timedelta
from typing import Literal
from urllib.parse import urlparse
from uuid import UUID
import os

from flask import request
from pydantic import Field, field_validator
from sqlalchemy.orm import Session

import models
from database import get_db
from flask_app.params import Depends, HTTPException
from routers.auth import get_current_active_user
from services import notifications as push
from services.abuse_limits import consume
from services.feature_flags import is_enabled
from services.personalization_inputs import Strict

TypeName = Literal['daily_plan', 'workout', 'meal_log', 'rest_day', 'motivation', 'milestone', 'event_update', 'social', 'record', 'weekly_summary']


class Keys(Strict):
    p256dh: str = Field(min_length=20, max_length=200)
    auth: str = Field(min_length=8, max_length=100)


class SubscribeInput(Strict):
    endpoint: str = Field(min_length=20, max_length=1000)
    keys: Keys
    old_endpoint: str | None = Field(default=None, max_length=1000)  # sent by the service worker on pushsubscriptionchange

    @field_validator('endpoint', 'old_endpoint')
    @classmethod
    def https(cls, value):
        if value is not None and (urlparse(value).scheme != 'https' or not urlparse(value).hostname): raise ValueError('Push endpoints must be HTTPS URLs.')
        return value


class UnsubscribeInput(Strict):
    endpoint: str = Field(min_length=20, max_length=1000)


class TypeChoice(Strict):
    enabled: bool
    time: str | None = Field(default=None, pattern=r'^(?:[01]\d|2[0-3]):[0-5]\d$')


class SettingsInput(Strict):
    enabled: bool
    types: dict[TypeName, TypeChoice] = Field(default_factory=dict)
    max_per_day: int = Field(default=2, ge=1, le=5)
    snooze: Literal['keep', 'clear', '1d', '1w'] = 'keep'


def require_flag(db: Session):
    if not is_enabled(db, 'web_push'): raise HTTPException(404, 'Notifications are not available yet.')


def config(db: Session = Depends(get_db)):
    """Public: whether push is offered, and the VAPID public key (the private key never leaves the server)."""
    key = os.getenv('VAPID_PUBLIC_KEY', '')
    return {'enabled': bool(is_enabled(db, 'web_push') and key and os.getenv('VAPID_PRIVATE_KEY')), 'public_key': key}


def view(db, user):
    settings = push.settings_for(db, user.id)
    zone, quiet_start, quiet_end = push.preferences(db, user.id)
    devices = db.query(models.PushSubscription).filter_by(user_id=user.id).order_by(models.PushSubscription.created_at).all()
    types = {**push.DEFAULT_TYPES, **((settings.types or {}) if settings else {})}  # saved settings can predate a type
    return {'enabled': bool(settings and settings.enabled), 'types': types, 'max_per_day': settings.max_per_day if settings else 2,
            'snooze_until': settings.snooze_until.isoformat() + 'Z' if settings and settings.snooze_until else None,
            'timezone': zone.key, 'quiet_start': quiet_start, 'quiet_end': quiet_end,
            'devices': [{'id': d.id, 'user_agent': d.user_agent or 'Browser', 'created_at': d.created_at.isoformat() + 'Z'} for d in devices]}


def get_settings(user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); return view(db, user)


def put_settings(data: SettingsInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); consume(db, 'push-settings', str(user.id), 60, 3600)
    settings = push.settings_for(db, user.id, lock=True)
    if not settings:
        settings = models.NotificationSettings(user_id=user.id, enabled=False, types=dict(push.DEFAULT_TYPES), max_per_day=2); db.add(settings)
    was_on = settings.enabled
    types = {**push.DEFAULT_TYPES, **(settings.types or {})}
    for name, choice in data.types.items():
        types[name] = {'enabled': choice.enabled, 'time': (choice.time or types[name]['time']) if push.TYPES[name]['time'] else None}
    settings.enabled, settings.types, settings.max_per_day = data.enabled, types, data.max_per_day
    now = push.utcnow()
    if data.snooze == 'clear': settings.snooze_until = None
    elif data.snooze in ('1d', '1w'): settings.snooze_until = now + timedelta(days=1 if data.snooze == '1d' else 7)
    # Anything already planned that no longer applies is cancelled now, not at send time.
    pending = db.query(models.ScheduledNotification).filter_by(user_id=user.id, status='pending')
    for row in pending:
        choice = types.get(row.type, {})
        if not data.enabled or not choice.get('enabled') or (choice.get('time') and not row.idempotency_key.endswith(':' + choice['time'])):
            row.status, row.last_error = 'skipped', 'settings changed'
    if was_on != data.enabled: push.event(db, 'opt_in' if data.enabled else 'opt_out')
    db.commit()
    return view(db, user)


def subscribe(data: SubscribeInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db); consume(db, 'push-subscribe', str(user.id), 30, 3600)
    if data.old_endpoint:
        old = db.query(models.PushSubscription).filter_by(endpoint_hash=push.endpoint_hash(data.old_endpoint), user_id=user.id).first()
        if old: db.delete(old)
    digest = push.endpoint_hash(data.endpoint)
    row = db.query(models.PushSubscription).filter_by(endpoint_hash=digest).with_for_update().first()
    if row: row.user_id = user.id  # same browser, now signed in as this person
    else:
        row = models.PushSubscription(user_id=user.id, endpoint=data.endpoint, endpoint_hash=digest); db.add(row)
        if not data.old_endpoint: push.event(db, 'device_added')
    row.p256dh, row.auth = data.keys.p256dh, data.keys.auth
    row.user_agent = (request.headers.get('User-Agent') or '')[:200] or None
    db.commit()
    return {'status': 'subscribed', 'id': row.id}


def unsubscribe(data: UnsubscribeInput, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    row = db.query(models.PushSubscription).filter_by(endpoint_hash=push.endpoint_hash(data.endpoint), user_id=user.id).first()
    if row: db.delete(row); push.event(db, 'device_removed')
    db.commit()
    return {'status': 'unsubscribed'}


def opened(identifier: UUID, user=Depends(get_current_active_user), db: Session = Depends(get_db)):
    require_flag(db)
    row = db.query(models.ScheduledNotification).filter_by(id=str(identifier), user_id=user.id).first()
    if not row: raise HTTPException(404, 'Notification not found.')
    if row.status == 'sent' and not row.opened_at: row.opened_at = push.utcnow(); push.event(db, 'opened')
    db.commit()
    return {'status': 'recorded'}


def motivation(day: str | None = None):
    """Public: today's original motivation line. The browser passes its local date."""
    from datetime import date
    try: chosen = date.fromisoformat(day) if day else push.utcnow().date()
    except ValueError: raise HTTPException(422, 'Use YYYY-MM-DD.')
    return {'day': str(chosen), 'message': push.motivation_for(chosen)}
