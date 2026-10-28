"""Workout sessions endpoints under /api/v1/wellness."""
from flask import Blueprint

from flask_app import before_each, route
from routers import training as handlers

bp = Blueprint('training', __name__, url_prefix='/api/v1/wellness')
route(bp, 'GET', '/exercises', handlers.exercises)
route(bp, 'GET', '/exercises/<identifier>', handlers.exercise)
route(bp, 'GET', '/training', handlers.dashboard)
route(bp, 'POST', '/templates', handlers.blueprint)
route(bp, 'DELETE', '/templates/<identifier>', handlers.remove_blueprint)
route(bp, 'POST', '/sessions', handlers.start)
route(bp, 'GET', '/sessions/<identifier>', handlers.get_session)
route(bp, 'PUT', '/sessions/<identifier>', handlers.update)
route(bp, 'DELETE', '/sessions/<identifier>', handlers.delete_session)
