"""Nutrition dashboard endpoints under /api/v1/nutrition."""
from flask import Blueprint

from flask_app import before_each, route
from routers import nutrition as handlers

bp = Blueprint('nutrition', __name__, url_prefix='/api/v1/nutrition')
route(bp, 'GET', '/daily', handlers.daily_summary)
route(bp, 'GET', '/micronutrients', handlers.micronutrients)
route(bp, 'GET', '/weekly', handlers.weekly_summary)
route(bp, 'GET', '/trends', handlers.monthly_trends)
route(bp, 'POST', '/water', handlers.log_water, status=201)
route(bp, 'GET', '/coach/recommend-fill', handlers.recommend_macro_fill)
