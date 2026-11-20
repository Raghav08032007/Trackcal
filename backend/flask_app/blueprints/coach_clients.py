"""Trainer dashboard under /api/v1/coach-clients (flag organizer_saas)."""
from flask import Blueprint

from flask_app import route
from routers import coach_clients as handlers

bp = Blueprint('coach_clients', __name__, url_prefix='/api/v1/coach-clients')
route(bp, 'GET', '', handlers.clients)
route(bp, 'POST', '/invites', handlers.create_invite, status=201)
route(bp, 'GET', '/mine', handlers.my_coaches)
route(bp, 'POST', '/join', handlers.join, status=201)
route(bp, 'GET', '/<link_id>', handlers.client_detail)
route(bp, 'PUT', '/<link_id>/share', handlers.update_share)
route(bp, 'DELETE', '/<link_id>', handlers.end)
