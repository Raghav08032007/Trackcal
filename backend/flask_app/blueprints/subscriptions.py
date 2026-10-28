"""Subscriptions endpoints under /api/v1/subscriptions."""
from flask import Blueprint

from flask_app import before_each, route
from routers import subscriptions as handlers

bp = Blueprint('subscriptions', __name__, url_prefix='/api/v1/subscriptions')
route(bp, 'GET', '/plans', handlers.list_plans)
route(bp, 'GET', '/status', handlers.subscription_status)
route(bp, 'GET', '/history', handlers.billing_history)
route(bp, 'POST', '/cancel', handlers.cancel_subscription)
