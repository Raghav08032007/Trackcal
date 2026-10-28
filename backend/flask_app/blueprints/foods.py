"""Foods and nutrition endpoints under /api/v1/foods."""
from flask import Blueprint

from flask_app import before_each, route
from routers import foods as handlers

bp = Blueprint('foods', __name__, url_prefix='/api/v1/foods')
route(bp, 'GET', '/search', handlers.search_foods)
route(bp, 'GET', '/barcode/<barcode>', handlers.lookup_barcode)
route(bp, 'GET', '/<food_id>', handlers.get_food)
route(bp, 'POST', '/custom', handlers.create_custom_food, status=201)
route(bp, 'GET', '/custom/mine', handlers.list_custom_foods)
