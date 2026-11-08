"""GPS activity endpoints under /api/v1/activities."""
from flask import Blueprint

from flask_app import route
from routers import activities as handlers

bp = Blueprint('activities', __name__, url_prefix='/api/v1/activities')
route(bp, 'GET', '/records', handlers.records)
route(bp, 'GET', '/privacy-zones', handlers.list_zones)
route(bp, 'POST', '/privacy-zones', handlers.add_zone, status=201)
route(bp, 'DELETE', '/privacy-zones/<zone_id>', handlers.remove_zone)
route(bp, 'POST', '', handlers.create, status=201)
route(bp, 'GET', '', handlers.list_activities)
route(bp, 'GET', '/<activity_id>', handlers.get_activity)
route(bp, 'PATCH', '/<activity_id>', handlers.edit)
route(bp, 'DELETE', '/<activity_id>', handlers.delete, status=204)
