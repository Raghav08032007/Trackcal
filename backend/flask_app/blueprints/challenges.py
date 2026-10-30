"""Verified challenges under /api/v1/challenges (flags verified_challenges + social_feed)."""
from flask import Blueprint

from flask_app import retry_deadlocks, route
from routers import challenges as handlers

bp = Blueprint('challenges', __name__, url_prefix='/api/v1/challenges')
retry_deadlocks(bp)  # completing a challenge awards XP
route(bp, 'GET', '', handlers.listing)
route(bp, 'POST', '', handlers.create, status=201)
route(bp, 'GET', '/<challenge_id>', handlers.detail)
route(bp, 'DELETE', '/<challenge_id>', handlers.cancel)
route(bp, 'POST', '/<challenge_id>/participation', handlers.join)
route(bp, 'DELETE', '/<challenge_id>/participation', handlers.leave)
