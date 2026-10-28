"""Coach appointments endpoints under /api/v1/coaching."""
from flask import Blueprint

from flask_app import before_each, route
from routers import coaching as handlers

bp = Blueprint('coaching', __name__, url_prefix='/api/v1/coaching')
before_each(bp, handlers.request_limit)
route(bp, 'GET', '/coaches', handlers.coaches)
route(bp, 'POST', '/slots', handlers.publish, status=201)
route(bp, 'GET', '/slots', handlers.slots)
route(bp, 'DELETE', '/slots/<slot_id>', handlers.unpublish)
route(bp, 'POST', '/bookings', handlers.reserve, status=201)
route(bp, 'GET', '/bookings', handlers.bookings)
route(bp, 'PATCH', '/bookings/<booking_id>', handlers.reschedule)
route(bp, 'DELETE', '/bookings/<booking_id>', handlers.cancel)
