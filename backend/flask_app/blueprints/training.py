"""Workout sessions endpoints under /api/v1/wellness."""
from flask import Blueprint

from flask_app import before_each, retry_deadlocks, route
from routers import training as handlers
from routers import workout_history as history
from routers import training_trend

bp = Blueprint('training', __name__, url_prefix='/api/v1/wellness')
retry_deadlocks(bp)  # XP awards; handlers make no external calls before committing
route(bp, 'GET', '/exercises', handlers.exercises)
route(bp, 'GET', '/exercises/<identifier>', handlers.exercise)
route(bp, 'GET', '/training', handlers.dashboard)
route(bp, 'POST', '/templates', handlers.blueprint)
route(bp, 'DELETE', '/templates/<identifier>', handlers.remove_blueprint)
route(bp, 'POST', '/sessions', handlers.start)
route(bp, 'GET', '/sessions/<identifier>', handlers.get_session)
route(bp, 'PUT', '/sessions/<identifier>', handlers.update)
route(bp, 'DELETE', '/sessions/<identifier>', handlers.delete_session)
route(bp, 'POST', '/sessions/<identifier>/restore', history.restore_session)
route(bp, 'GET', '/history', history.history)
route(bp, 'GET', '/trend', training_trend.trend)
route(bp, 'POST', '/entries', history.add_entry)
route(bp, 'PUT', '/entries/<identifier>', history.edit_entry)
route(bp, 'DELETE', '/entries/<identifier>', history.remove_entry)
route(bp, 'POST', '/entries/<identifier>/restore', history.restore_entry)
route(bp, 'GET', '/library', history.get_library)
route(bp, 'POST', '/library', history.change_library)
route(bp, 'POST', '/library/import', history.import_library)
