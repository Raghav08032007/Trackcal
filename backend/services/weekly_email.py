"""The Monday weekly-summary email (Phase H), opt-in from Your weeks.

Run on every scheduler tick: for each person who turned it on and has a verified email, once it is Monday 09:00 or later in their
own time zone, send last week's summary (the same numbers as the Your weeks page). A row in scheduled_notifications with the key
user:weekly_email:monday, inserted before sending, makes it once a week however often the tick runs or retries. Its status is
'emailed', so it never counts towards the push daily cap. The email holds weekly totals only: no weight, food or health details.
"""
from __future__ import annotations

import html
import logging
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.dialects.mysql import insert

import models
from services import account_mail
from services import training_load as tl

log = logging.getLogger(__name__)
SEND_HOUR = 9


def due(db, now: datetime):
    """(user, preferences, Monday) for everyone whose email is due now."""
    from services.personalization_inputs import Preferences
    rows = db.query(models.PersonalizationProfile).filter(func.json_extract(models.PersonalizationProfile.preferences, '$.weekly_email') == True).all()  # noqa: E712
    for profile in rows:
        user = db.get(models.User, profile.user_id)
        if not user or not user.email_verified or user.is_active is False or user.deleted_at:
            continue
        prefs = Preferences.model_validate(profile.preferences)
        try:
            local = now.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(prefs.timezone))
        except Exception:
            continue
        if local.weekday() == 0 and local.hour >= SEND_HOUR:
            yield user, prefs, local.date()


def compose(base: str, address: str, summary: dict) -> EmailMessage:
    week = summary['weeks'][-1]
    g = tl.guideline(week['met_minutes'], 7)
    lines = [f"Your week of {week['start']}:", '',
             f"  {week['met_minutes']:,} MET-minutes of effort", f"  {week['minutes']} active minutes over {week['active_days']} days"]
    if week['distance_m']:
        lines.append(f"  {week['distance_m'] / 1000:.1f} km by GPS")
    lines += ['', g['text'], summary['trend']['message'], '', f'See it all: {base}/weekly',
              f'Turn this email off on the same page: {base}/weekly', '', 'Estimates to help you, never a medical assessment.']
    message = EmailMessage()
    message['Subject'] = 'Your week in TrackCal'
    message['To'] = address
    message.set_content('\n'.join(lines))
    rows = ''.join(f'<tr><td style="padding:6px 12px">{html.escape(label)}</td><td style="padding:6px 12px;text-align:right"><b>{html.escape(value)}</b></td></tr>'
                   for label, value in [('Effort', f"{week['met_minutes']:,} MET-minutes"), ('Active time', f"{week['minutes']} minutes"),
                                        ('Active days', str(week['active_days']))] + ([('GPS distance', f"{week['distance_m'] / 1000:.1f} km")] if week['distance_m'] else []))
    message.add_alternative(
        f'<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1c1917">'
        f'<div style="background:#6d28d9;color:#fff;padding:20px;border-radius:16px"><h1 style="margin:0;font-size:22px">Your week in TrackCal</h1>'
        f'<p style="margin:6px 0 0">Week of {html.escape(week["start"])}</p></div>'
        f'<table style="width:100%;margin:16px 0;border-collapse:collapse">{rows}</table>'
        f'<p>{html.escape(g["text"])}</p><p>{html.escape(summary["trend"]["message"])}</p>'
        f'<p><a href="{html.escape(base)}/weekly" style="background:#6d28d9;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">See your weeks</a></p>'
        f'<p style="font-size:12px;color:#57534e">Estimates to help you, never a medical assessment. '
        f'<a href="{html.escape(base)}/weekly" style="color:#57534e">Turn this email off</a>.</p></div>', subtype='html')
    return message


def run(db, now: datetime | None = None) -> int:
    """Send every weekly email that is due. Returns how many were sent."""
    from routers.training_trend import collect
    now = now or datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        base = account_mail.configuration()
    except RuntimeError:
        return 0   # email isn't set up: nothing to do, and nothing is marked as sent
    sent = 0
    for user, prefs, monday in list(due(db, now)):
        key = f'{user.id}:weekly_email:{monday}'
        claimed = db.execute(insert(models.ScheduledNotification).prefix_with('IGNORE').values(
            id=str(uuid.uuid4()), user_id=user.id, type='weekly_email', local_day=str(monday), scheduled_for_utc=now,
            idempotency_key=key, status='emailed', attempts=1, created_at=now)).rowcount
        db.commit()
        if not claimed:
            continue
        last_sunday = monday - timedelta(days=1)
        summary = tl.summarise(collect(db, user.id, prefs, last_sunday, 4), last_sunday, 4)
        try:
            account_mail.send(compose(base, user.email, summary))
            sent += 1
        except Exception:
            log.warning('weekly email failed')   # no address or content in logs
            db.query(models.ScheduledNotification).filter_by(idempotency_key=key).delete()   # try again on the next tick
            db.commit()
    return sent
