"""Support endpoints under /api/v1/support."""
from flask import Blueprint

from flask_app import before_each, route
from routers import support as handlers

bp = Blueprint('support', __name__, url_prefix='/api/v1/support')
route(bp, 'POST', '', handlers.create_ticket, status=201)
route(bp, 'GET', '', handlers.list_tickets)
route(bp, 'GET', '/<ticket_id>', handlers.get_ticket)
