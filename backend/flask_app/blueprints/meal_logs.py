"""Meal logging endpoints under /api/v1/meal-logs."""
from flask import Blueprint

from flask_app import before_each, route
from routers import meal_logs as handlers

bp = Blueprint('meal_logs', __name__, url_prefix='/api/v1/meal-logs')
route(bp, 'POST', '', handlers.create_meal_log, status=201)
route(bp, 'GET', '', handlers.list_meal_logs)
route(bp, 'GET', '/<log_id>', handlers.get_meal_log)
route(bp, 'DELETE', '/<log_id>', handlers.delete_meal_log)
route(bp, 'POST', '/<log_id>/copy', handlers.copy_meal_log)
route(bp, 'PATCH', '/<log_id>/items/<item_id>/confirm', handlers.confirm_item)
