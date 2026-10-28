"""Habit adventure endpoints under /api/v1/adventure."""
from flask import Blueprint

from flask_app import before_each, route
from routers import adventure as handlers

bp = Blueprint('adventure', __name__, url_prefix='/api/v1/adventure')
route(bp, 'POST', '/initialize', handlers.initialize)
route(bp, 'GET', '/summary', handlers.summary)
route(bp, 'POST', '/review-meal', handlers.review_meal)
route(bp, 'POST', '/game/start', handlers.game_start)
route(bp, 'POST', '/game/submit', handlers.game_submit)
route(bp, 'POST', '/review-workout', handlers.review_workout)
route(bp, 'POST', '/rest-day', handlers.rest_day)
route(bp, 'POST', '/companion-settings', handlers.companion_settings)
