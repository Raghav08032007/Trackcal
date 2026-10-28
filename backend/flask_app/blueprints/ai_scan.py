"""AI scanning endpoints under /api/v1/scan."""
from flask import Blueprint

from flask_app import before_each, route
from routers import ai_scan as handlers

bp = Blueprint('ai_scan', __name__, url_prefix='/api/v1/scan')
route(bp, 'POST', '/photo', handlers.scan_photo)
route(bp, 'POST', '/adjust-cooking-style', handlers.adjust_cooking_style)
route(bp, 'POST', '/text', handlers.scan_text)
route(bp, 'POST', '/corrections', handlers.submit_correction)
route(bp, 'GET', '/jobs/<job_id>', handlers.get_scan_job)
route(bp, 'GET', '/barcode/<barcode_value>', handlers.scan_barcode)
route(bp, 'DELETE', '/images/<image_id>', handlers.delete_image)
