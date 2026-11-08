"""Blood report endpoints under /api/v1/health."""
from flask import Blueprint

from flask_app import route
from routers import health as handlers

bp = Blueprint('health', __name__, url_prefix='/api/v1/health')
route(bp, 'GET', '/tests', handlers.catalogue)
route(bp, 'POST', '/read', handlers.read)
route(bp, 'GET', '/summary', handlers.summary)
route(bp, 'POST', '/reports', handlers.save, status=201)
route(bp, 'DELETE', '/reports/<report_id>', handlers.delete, status=204)
