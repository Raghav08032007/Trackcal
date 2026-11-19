"""Opt-in web push reminders (Phase 4, behind the `web_push` flag).

Flow, run every minute by POST /internal/tick:
  1. plan():  for people with notifications on and at least one device, create today's and tomorrow's rows in
     scheduled_notifications at their chosen local times (IANA time zone, so daylight saving is handled). The
     idempotency key user:type:local day:slot makes re-planning harmless. Times inside quiet hours are not planned.
  2. claim(): take due rows with SELECT ... FOR UPDATE SKIP LOCKED and mark them 'sending', so a second worker
     running at the same moment skips them.
  3. deliver(): re-check the switch, snooze, quiet hours and the daily cap at send time, then push to each device.
     404/410 removes the device; 5xx/429/network errors retry with exponential backoff, then give up.
Payloads hold only a title, a neutral body and a link: never health details. Logs hold no personal data.
"""
import hashlib
import json
import logging
import os
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.dialects.mysql import insert

import models
from services.feature_flags import is_enabled
from services.personalization import quiet
from services.i18n import msg, tr

log = logging.getLogger('trackcal.push')
MAX_ATTEMPTS, STALE_MINUTES, LATE_HOURS, TTL_SECONDS = 5, 10, 2, 4 * 3600

# Copy reviewed against the engagement ethics: optional, no guilt, no streak pressure, no health details.
TYPES = {
    'daily_plan': {'time': '08:00', 'title': msg("Today's plan is ready"), 'body': msg('Open TrackCal whenever it suits you.'), 'url': '/plan'},
    'workout': {'time': '18:00', 'title': msg('Your activity reminder'), 'body': msg("The one you set. Skip or move it if today isn't the day."), 'url': '/workouts'},
    'meal_log': {'time': '13:00', 'title': msg('Meal check-in'), 'body': msg('Log a meal if you like. Missing one is fine.'), 'url': '/nutrition'},
    'rest_day': {'time': '20:00', 'title': msg('Rest counts too'), 'body': msg('Recovery is part of every plan.'), 'url': '/plan'},
    'motivation': {'time': '09:00', 'title': msg('A thought for today'), 'body': None, 'url': '/'},
    'milestone': {'time': None, 'title': msg('Something to celebrate'), 'body': msg("You've unlocked something new in TrackCal."), 'url': '/play'},
    'event_update': {'time': None, 'title': msg('An event you joined has changed'), 'body': msg('It may be cancelled or changed. Check your events.'), 'url': '/events'},
    # Phase H: who and what stay out of the message; opening the app shows them.
    'social': {'time': None, 'title': msg('Someone cheered you on'), 'body': msg('You have new kudos, comments or followers.'), 'url': '/feed'},
    'record': {'time': None, 'title': msg('A new personal best'), 'body': msg('You beat one of your own records. Take a look.'), 'url': '/activities'},
    'weekly_summary': {'time': '09:00', 'weekday': 0, 'title': msg('Your week in TrackCal'), 'body': msg('Your weekly summary is ready.'), 'url': '/weekly'},
    # Reminders: the event's name stays out of the message, as with event updates.
    'event_reminder': {'time': None, 'title': msg('Your event starts soon'), 'body': msg('An event you signed up for starts within the hour. Check the place and time.'), 'url': '/events'},
    'trial_ending': {'time': None, 'title': msg('Your Premium trial ends soon'), 'body': msg('Your trial ends in two days. Keep Premium, or cancel any time in Me. Nothing is charged before the trial ends.'), 'url': '/premium'},
}
SOCIAL_BUNDLE_MINUTES = 30   # kudos, comments and follows within one half hour arrive as one notification
SCHEDULED = [t for t, v in TYPES.items() if v['time']]
DEFAULT_TYPES = {t: {'enabled': t in ('daily_plan', 'milestone', 'event_update', 'social', 'record', 'weekly_summary', 'event_reminder', 'trial_ending'), 'time': v['time']} for t, v in TYPES.items()}
EVENT_REMINDER_MINUTES, TRIAL_REMINDER_HOURS = 60, 48


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def event(db, kind):
    db.add(models.NotificationEvent(kind=kind))


def settings_for(db, user_id, lock=False):
    query = db.query(models.NotificationSettings).filter_by(user_id=str(user_id))
    row = (query.with_for_update() if lock else query).first()
    if row: row.types = {**DEFAULT_TYPES, **(row.types or {})}
    return row


def type_settings(settings, kind):
    """Saved settings can predate a type, so a missing one falls back to its default."""
    return (settings.types or {}).get(kind) or DEFAULT_TYPES[kind]


def preferences(db, user_id):
    """Time zone and quiet hours from the person's existing preferences (one source of truth)."""
    from services.personalization_inputs import Preferences
    row = db.get(models.PersonalizationProfile, str(user_id))
    prefs = Preferences.model_validate(row.preferences) if row else Preferences()
    try: zone = ZoneInfo(prefs.timezone)
    except Exception: zone = ZoneInfo('UTC')
    return zone, prefs.reminders.quiet_start, prefs.reminders.quiet_end


def local_slot_utc(day: date, hhmm: str, zone: ZoneInfo) -> datetime:
    """Local wall-clock time on `day` → naive UTC. A time that doesn't exist (spring-forward gap) resolves to the
    same instant as the hour before the change, i.e. it fires one hour 'early' by the new clock, never twice."""
    hour, minute = map(int, hhmm.split(':'))
    return datetime.combine(day, time(hour, minute), zone).astimezone(timezone.utc).replace(tzinfo=None)


def motivation_for(day: date) -> str:
    with open(os.path.join(os.path.dirname(__file__), '..', 'data', 'motivation.json'), encoding='utf-8') as handle:
        messages = json.load(handle)['messages']
    return messages[day.toordinal() % len(messages)]


def payload(row, lang='en') -> dict:
    """What the phone shows, in the account's language (lang)."""
    spec = TYPES[row.type]
    body = spec['body'] or motivation_for(date.fromisoformat(row.local_day))
    return {'id': row.id, 'type': row.type, 'title': tr(spec['title'], lang=lang), 'body': tr(body, lang=lang), 'url': spec['url']}


def language(db, user_id):
    """The language saved on this account (services.i18n.for_preferences)."""
    from routers.personalization import prefs_for
    from services.i18n import for_preferences
    return for_preferences(prefs_for(db.get(models.PersonalizationProfile, user_id)))


def plan(db, now=None):
    """Create upcoming rows for everyone with notifications on. Safe to run every minute."""
    now = now or utcnow(); created = 0
    rows = db.query(models.NotificationSettings).filter_by(enabled=True).all()
    for settings in rows:
        if not db.query(models.PushSubscription.id).filter_by(user_id=settings.user_id).first(): continue
        zone, quiet_start, quiet_end = preferences(db, settings.user_id)
        today = now.replace(tzinfo=timezone.utc).astimezone(zone).date()
        types = {**DEFAULT_TYPES, **(settings.types or {})}
        for day in (today, today + timedelta(days=1)):
            for kind in SCHEDULED:
                choice = types[kind]
                if not choice.get('enabled'): continue
                if quiet(choice['time'], quiet_start, quiet_end): continue
                if TYPES[kind].get('weekday') is not None and day.weekday() != TYPES[kind]['weekday']: continue   # weekly ones, on their day
                when = local_slot_utc(day, choice['time'], zone)
                if when < now - timedelta(minutes=5): continue  # turned on after today's time: start tomorrow
                result = db.execute(insert(models.ScheduledNotification).prefix_with('IGNORE').values(
                    id=_uuid(), user_id=settings.user_id, type=kind, local_day=str(day), scheduled_for_utc=when,
                    idempotency_key=f'{settings.user_id}:{kind}:{day}:{choice["time"]}', status='pending', attempts=0, created_at=now))
                created += result.rowcount
    plan_reminders(db, now)
    db.commit()
    return created


def plan_reminders(db, now=None):
    """Once per event and per trial: events starting within the hour for everyone going, and trials ending within 2 days.
    Settings, quiet hours and the daily cap apply as for every type (_enqueue_now and deliver)."""
    now = now or utcnow()
    soon = (db.query(models.EventRegistration.user_id, models.Event.id).join(models.Event, models.Event.id == models.EventRegistration.event_id)
            .filter(models.EventRegistration.status == 'going', models.Event.status == 'scheduled',
                    models.Event.starts_at > now, models.Event.starts_at <= now + timedelta(minutes=EVENT_REMINDER_MINUTES)).all())
    for user_id, event_id in soon: _enqueue_now(db, user_id, 'event_reminder', f'remind:{event_id}', now)
    ending = (db.query(models.Subscription).filter(models.Subscription.status == models.SubscriptionStatus.trialing, models.Subscription.cancelled_at.is_(None),
              models.Subscription.trial_ends_at > now, models.Subscription.trial_ends_at <= now + timedelta(hours=TRIAL_REMINDER_HOURS)).all())
    for sub in ending: _enqueue_now(db, sub.user_id, 'trial_ending', f'trial:{sub.id}:{sub.trial_ends_at.date()}', now)


def enqueue_milestone(db, user_id, code, now=None):
    """Called when an achievement unlocks. Sent at the next tick, or after quiet hours end."""
    _enqueue_now(db, user_id, 'milestone', code, now)


def notify_social(db, recipient_id, actor_id, now=None):
    """Kudos, a comment or a follow. Nothing for your own actions or from someone you muted; one per half hour, bundled."""
    if str(recipient_id) == str(actor_id): return
    if db.query(models.SocialBlock.user_id).filter_by(user_id=str(recipient_id), target_id=str(actor_id)).first(): return
    now = now or utcnow()
    bucket = int(now.replace(tzinfo=timezone.utc).timestamp() // (SOCIAL_BUNDLE_MINUTES * 60))
    _enqueue_now(db, recipient_id, 'social', f'social:{bucket}', now)


def notify_record(db, user_id, source_id, now=None):
    """A new personal best on an activity or a segment. Once per activity."""
    _enqueue_now(db, user_id, 'record', f'record:{source_id}', now)


def notify_event_change(db, event_id, reason, now=None):
    """An event was cancelled or hidden: tell everyone still signed up. Nothing about the event is in the message."""
    rows = db.query(models.EventRegistration.user_id).filter(models.EventRegistration.event_id == event_id, models.EventRegistration.status.in_(['going', 'waitlist'])).all()
    for (user_id,) in rows: _enqueue_now(db, user_id, 'event_update', f'{event_id}:{reason}', now)


def _enqueue_now(db, user_id, kind, code, now=None):
    if not is_enabled(db, 'web_push'): return
    settings = settings_for(db, user_id)
    if not settings or not settings.enabled or not type_settings(settings, kind).get('enabled'): return
    now = now or utcnow(); zone, quiet_start, quiet_end = preferences(db, user_id)
    local = now.replace(tzinfo=timezone.utc).astimezone(zone)
    when = now
    if quiet(local.strftime('%H:%M'), quiet_start, quiet_end):
        end = local_slot_utc(local.date(), quiet_end, zone)
        when = end if end > now else local_slot_utc(local.date() + timedelta(days=1), quiet_end, zone)
    db.execute(insert(models.ScheduledNotification).prefix_with('IGNORE').values(
        id=_uuid(), user_id=str(user_id), type=kind, local_day=str(local.date()), scheduled_for_utc=when,
        idempotency_key=f'{user_id}:{kind}:{code}'[:120], status='pending', attempts=0, created_at=now))


def claim(db, now=None, limit=50):
    """Lock due rows (skipping any another worker holds), mark them 'sending' and commit. Returns their ids."""
    now = now or utcnow()
    due = (db.query(models.ScheduledNotification)
           .filter(((models.ScheduledNotification.status == 'pending') & (models.ScheduledNotification.scheduled_for_utc <= now)
                    & ((models.ScheduledNotification.next_attempt_at.is_(None)) | (models.ScheduledNotification.next_attempt_at <= now)))
                   | ((models.ScheduledNotification.status == 'sending') & (models.ScheduledNotification.next_attempt_at <= now - timedelta(minutes=STALE_MINUTES))))
           .order_by(models.ScheduledNotification.scheduled_for_utc).limit(limit).with_for_update(skip_locked=True).all())
    for row in due:
        row.status, row.attempts, row.next_attempt_at = 'sending', row.attempts + 1, now  # next_attempt_at marks the claim time
    ids = [row.id for row in due]
    db.commit()
    return ids


def _finish(row, status, error=None, now=None):
    row.status, row.last_error = status, (error or None) and error[:200]
    if status == 'sent': row.sent_at = now


def deliver(db, notification_id, send, now=None):
    """Send one claimed row. `send(subscription, payload) -> HTTP status (0 for a network error)`."""
    now = now or utcnow()
    row = db.query(models.ScheduledNotification).filter_by(id=notification_id).with_for_update().first()
    if not row or row.status != 'sending': db.commit(); return None
    settings = settings_for(db, row.user_id)
    zone, quiet_start, quiet_end = preferences(db, row.user_id)
    local = now.replace(tzinfo=timezone.utc).astimezone(zone)
    sent_today = db.query(func.count(models.ScheduledNotification.id)).filter_by(user_id=row.user_id, local_day=row.local_day, status='sent').scalar()
    reason = ('feature off' if not is_enabled(db, 'web_push') else 'turned off' if not settings or not settings.enabled or not type_settings(settings, row.type).get('enabled')
              else 'snoozed' if settings.snooze_until and settings.snooze_until > now
              else 'quiet hours' if quiet(local.strftime('%H:%M'), quiet_start, quiet_end)
              else 'daily cap' if sent_today >= settings.max_per_day
              else 'too late' if now - row.scheduled_for_utc > timedelta(hours=LATE_HOURS) else None)
    if reason: _finish(row, 'skipped', reason); db.commit(); return 'skipped'
    devices = db.query(models.PushSubscription).filter_by(user_id=row.user_id).all()
    if not devices: _finish(row, 'skipped', 'no device'); db.commit(); return 'skipped'
    body, delivered, transient, permanent = payload(row, language(db, row.user_id)), 0, 0, None
    for device in devices:
        status = send(device, body)
        if 200 <= status < 300: delivered += 1; device.last_success_at = now
        elif status in (404, 410): db.delete(device); event(db, 'expired')  # the browser dropped this subscription
        elif status == 0 or status == 429 or status >= 500: transient += 1
        else: permanent = f'push service refused ({status})'
        if not 200 <= status < 300: log.warning('push failed', extra={'status': status, 'type': row.type})
    if delivered: _finish(row, 'sent', now=now); event(db, 'sent')
    elif transient and row.attempts < MAX_ATTEMPTS:
        row.status, row.next_attempt_at, row.last_error = 'pending', now + timedelta(minutes=2 ** row.attempts), 'temporary failure, will retry'
    elif transient or permanent: _finish(row, 'failed', permanent or 'gave up after retries'); event(db, 'failed')
    else: _finish(row, 'skipped', 'no device')  # every device had expired
    db.commit()
    return row.status


def tick(session_factory, send, now=None, batch=50, max_batches=10):
    """One scheduler run: plan, then claim and send due rows in batches."""
    counts = {'planned': 0, 'sent': 0, 'skipped': 0, 'failed': 0, 'pending': 0}
    with session_factory() as db:
        if not is_enabled(db, 'web_push'): return {**counts, 'enabled': False}
        counts['planned'] = plan(db, now)
    for _ in range(max_batches):
        with session_factory() as db: ids = claim(db, now, batch)
        if not ids: break
        for identifier in ids:
            with session_factory() as db: result = deliver(db, identifier, send, now)
            if result in counts: counts[result] += 1
    return {**counts, 'enabled': True}


def webpush_sender():
    """The real sender (pywebpush). Returns None when VAPID keys are not configured."""
    private_key, subject = os.getenv('VAPID_PRIVATE_KEY'), os.getenv('VAPID_SUBJECT')
    if not private_key or not subject: return None
    from pywebpush import WebPushException, webpush

    def send(device, body):
        try:
            response = webpush(subscription_info={'endpoint': device.endpoint, 'keys': {'p256dh': device.p256dh, 'auth': device.auth}},
                               data=json.dumps(body), vapid_private_key=private_key, vapid_claims={'sub': subject}, ttl=TTL_SECONDS, timeout=10)
            return getattr(response, 'status_code', 201)
        except WebPushException as failure:
            return failure.response.status_code if failure.response is not None else 0
        except Exception:
            return 0
    return send


def endpoint_hash(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode()).hexdigest()


def _uuid():
    import uuid
    return str(uuid.uuid4())
