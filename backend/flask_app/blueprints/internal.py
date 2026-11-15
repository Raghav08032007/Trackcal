"""Operator endpoints under /internal, protected by the X-Tick-Secret header (TICK_SECRET). Not for browsers.

POST /internal/tick runs one scheduler pass. Free hosts sleep, so an external scheduler must call it every minute;
an always-on worker is the proper fix before public launch (docs/PUSH_NOTIFICATIONS.md).
GET /internal/notification-metrics returns guardrail counts (no personal data)."""
import hmac
import os
from datetime import timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

bp = Blueprint('internal', __name__, url_prefix='/internal')


def authorized():
    secret = os.getenv('TICK_SECRET', '')
    supplied = request.headers.get('X-Tick-Secret', '')
    return len(secret) >= 32 and hmac.compare_digest(secret.encode(), supplied.encode())


@bp.post('/tick')
def tick():
    if not authorized(): return jsonify({'error': 'Not found'}), 404
    import database
    from services import notifications as push, weekly_email
    with database.SessionLocal() as db:
        emailed = weekly_email.run(db)   # email doesn't depend on push being set up
    send = push.webpush_sender()
    if send is None: return jsonify({'error': 'VAPID keys are not configured.', 'emailed': emailed}), 503
    return jsonify({**push.tick(database.SessionLocal, send), 'emailed': emailed})


@bp.get('/notification-metrics')
def metrics():
    if not authorized(): return jsonify({'error': 'Not found'}), 404
    import database, models
    from services import notifications as push
    days = max(1, min(90, request.args.get('days', 30, type=int)))
    since = push.utcnow() - timedelta(days=days)
    with database.SessionLocal() as db:
        counts = dict(db.query(models.NotificationEvent.kind, func.count()).filter(models.NotificationEvent.created_at >= since).group_by(models.NotificationEvent.kind).all())
        people_on = db.query(func.count()).select_from(models.NotificationSettings).filter_by(enabled=True).scalar()
        devices = db.query(func.count(models.PushSubscription.id)).scalar()
    sent, failed, opened = counts.get('sent', 0), counts.get('failed', 0), counts.get('opened', 0)
    return jsonify({'days': days, 'events': counts, 'people_with_notifications_on': people_on, 'devices': devices,
                    'opt_ins': counts.get('opt_in', 0), 'opt_outs': counts.get('opt_out', 0),
                    'delivery_failure_rate': round(failed / (sent + failed), 3) if sent + failed else None,
                    'open_rate': round(opened / sent, 3) if sent else None,
                    'note': 'Guardrail metrics, not engagement targets.'})
