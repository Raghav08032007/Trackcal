"""Web push endpoints under /api/v1/push (flag `web_push`), plus the public daily motivation line."""
from flask import Blueprint

from flask_app import retry_deadlocks, route
from routers import push as handlers

bp = Blueprint('push', __name__, url_prefix='/api/v1')
retry_deadlocks(bp)
route(bp, 'GET', '/push/config', handlers.config)
route(bp, 'GET', '/push/settings', handlers.get_settings)
route(bp, 'PUT', '/push/settings', handlers.put_settings)
route(bp, 'POST', '/push/subscribe', handlers.subscribe)
route(bp, 'DELETE', '/push/subscribe', handlers.unsubscribe)
route(bp, 'POST', '/push/opened/<identifier>', handlers.opened)
route(bp, 'GET', '/motivation/today', handlers.motivation)
