"""Verified events under /api/v1/events (flags verified_events + social_feed)."""
from flask import Blueprint

from flask_app import retry_deadlocks, route
from routers import events as handlers

bp = Blueprint('events', __name__, url_prefix='/api/v1/events')
retry_deadlocks(bp)  # check-ins award XP
route(bp, 'GET', '', handlers.listing)
route(bp, 'POST', '', handlers.create, status=201)
route(bp, 'GET', '/<event_id>', handlers.detail)
route(bp, 'DELETE', '/<event_id>', handlers.cancel_event)
route(bp, 'POST', '/<event_id>/registration', handlers.register)
route(bp, 'DELETE', '/<event_id>/registration', handlers.unregister)
route(bp, 'GET', '/<event_id>/attendees', handlers.attendees)
route(bp, 'GET', '/<event_id>/check-in-code', handlers.check_in_code)
route(bp, 'POST', '/<event_id>/check-in', handlers.check_in)
