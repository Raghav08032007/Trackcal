"""Razorpay webhooks at /api/v1/billing/webhook. No cookies or sessions: the X-Razorpay-Signature HMAC of the raw body
(RAZORPAY_WEBHOOK_SECRET) is the only authentication. Each event id is applied once (services.billing.handle_event)."""
import json
import logging

from flask import Blueprint, jsonify, request

bp = Blueprint('billing_webhook', __name__, url_prefix='/api/v1/billing')
log = logging.getLogger('trackcal.billing')


@bp.post('/webhook')
def webhook():
    import database
    from services import billing
    from services.feature_flags import is_enabled
    raw = request.get_data(cache=False)
    if len(raw) > 200_000 or not billing.verify_webhook(raw, request.headers.get('X-Razorpay-Signature', '')):
        return jsonify({'error': 'Invalid signature'}), 400
    try: body = json.loads(raw)
    except ValueError: return jsonify({'error': 'Invalid JSON'}), 400
    event_id = request.headers.get('X-Razorpay-Event-Id') or f"{body.get('event')}:{body.get('created_at')}:{body.get('account_id')}"
    with database.SessionLocal() as db:
        if not is_enabled(db, 'billing'): return jsonify({'status': 'billing off'}), 200
        result = billing.handle_event(db, event_id[:100], body)
    log.info('billing webhook', extra={'event': body.get('event'), 'result': result})
    return jsonify({'status': result}), 200
