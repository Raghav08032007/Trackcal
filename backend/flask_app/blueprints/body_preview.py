"""AI body preview endpoints under /api/v1/body-preview (flag body_simulator)."""
from flask import Blueprint

from flask_app import route
from routers import body_preview as handlers

bp = Blueprint('body_preview', __name__, url_prefix='/api/v1/body-preview')
route(bp, 'GET', '', handlers.status)
route(bp, 'POST', '', handlers.create)
