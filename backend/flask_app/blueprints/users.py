"""Users endpoints under /api/v1/users."""
from flask import Blueprint

from flask_app import before_each, route
from routers import users as handlers

bp = Blueprint('users', __name__, url_prefix='/api/v1/users')
route(bp, 'GET', '/workspace', handlers.workspace)
route(bp, 'PUT', '/workspace', handlers.save_workspace)
route(bp, 'GET', '/profile', handlers.get_profile)
route(bp, 'PATCH', '/profile', handlers.update_profile)
route(bp, 'GET', '/settings', handlers.get_settings)
route(bp, 'PATCH', '/settings', handlers.update_settings)
route(bp, 'DELETE', '/account', handlers.delete_account)
route(bp, 'GET', '/export', handlers.export_data)
route(bp, 'POST', '/onboarding/calculate-plan', handlers.calculate_onboarding_plan)
