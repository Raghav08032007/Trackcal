"""Accuracy report under /api/v1/accuracy (site admins)."""
from flask import Blueprint

from flask_app import route
from routers import accuracy as handlers

bp = Blueprint('accuracy', __name__, url_prefix='/api/v1/accuracy')
route(bp, 'GET', '', handlers.report)
