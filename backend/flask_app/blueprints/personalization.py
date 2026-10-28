"""Personal wellness endpoints under /api/v1/personalization."""
from flask import Blueprint

from flask_app import before_each, route
from routers import personalization as handlers

bp = Blueprint('personalization', __name__, url_prefix='/api/v1/personalization')
route(bp, 'GET', '/state', handlers.state)
route(bp, 'POST', '/onboarding', handlers.save_progress)
route(bp, 'POST', '/measurements', handlers.save_measurement)
route(bp, 'DELETE', '/measurements/<identifier>', handlers.remove_measurement)
route(bp, 'POST', '/plans', handlers.generate_plan)
route(bp, 'POST', '/plans/<identifier>', handlers.update_plan)
route(bp, 'POST', '/activities/<identifier>', handlers.update_activity)
route(bp, 'POST', '/education', handlers.education)
route(bp, 'GET', '/reminders', handlers.due_reminders)
route(bp, 'POST', '/reminders/<identifier>', handlers.reminder_action)
