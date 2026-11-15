"""GPS activity endpoints under /api/v1/activities."""
from flask import Blueprint

from flask_app import route
from routers import activities as handlers
from routers import segments

bp = Blueprint('activities', __name__, url_prefix='/api/v1/activities')
route(bp, 'GET', '/records', handlers.records)
route(bp, 'GET', '/segments', segments.list_segments)
route(bp, 'POST', '/segments', segments.create_segment, status=201)
route(bp, 'GET', '/segments/settings', segments.get_setting)
route(bp, 'PATCH', '/segments/settings', segments.save_setting)
route(bp, 'GET', '/segments/<segment_id>', segments.get_segment)
route(bp, 'DELETE', '/segments/<segment_id>', segments.delete_segment, status=204)
route(bp, 'GET', '/privacy-zones', handlers.list_zones)
route(bp, 'POST', '/privacy-zones', handlers.add_zone, status=201)
route(bp, 'DELETE', '/privacy-zones/<zone_id>', handlers.remove_zone)
route(bp, 'POST', '', handlers.create, status=201)
route(bp, 'GET', '', handlers.list_activities)
route(bp, 'GET', '/<activity_id>', handlers.get_activity)
route(bp, 'PATCH', '/<activity_id>', handlers.edit)
route(bp, 'DELETE', '/<activity_id>', handlers.delete, status=204)
