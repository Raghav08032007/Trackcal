"""Community submissions endpoints under /api/v1/community."""
from flask import Blueprint

from flask_app import before_each, route
from routers import community as handlers

bp = Blueprint('community', __name__, url_prefix='/api/v1/community')
route(bp, 'POST', '', handlers.submit, status=201)
route(bp, 'GET', '/mine', handlers.my_submissions)
