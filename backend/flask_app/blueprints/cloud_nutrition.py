"""Cloud nutrition endpoints under /api/v1/wellness."""
from flask import Blueprint

from flask_app import before_each, retry_deadlocks, route
from routers import cloud_nutrition as handlers

bp = Blueprint('cloud_nutrition', __name__, url_prefix='/api/v1/wellness')
retry_deadlocks(bp)  # XP awards; handlers make no external calls before committing
route(bp, 'GET', '/foods', handlers.search)
route(bp, 'GET', '/foods/<identifier>', handlers.detail)
route(bp, 'GET', '/diary', handlers.diary)
route(bp, 'POST', '/diary', handlers.save_diary)
route(bp, 'PUT', '/diary/<identifier>', handlers.edit_diary)
route(bp, 'DELETE', '/diary/<identifier>', handlers.delete_diary)
route(bp, 'POST', '/diary/<identifier>/restore', handlers.restore_diary)
route(bp, 'POST', '/saved-meals', handlers.save_meal)
route(bp, 'DELETE', '/saved-meals/<identifier>', handlers.delete_saved)
route(bp, 'POST', '/favorites', handlers.favorite)
route(bp, 'DELETE', '/favorites/<identifier>', handlers.remove_favorite)
