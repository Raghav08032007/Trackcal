"""Open-source integrations endpoints under /api/v1/integrations."""
from flask import Blueprint

from flask_app import before_each, route
from routers import integrations as handlers

bp = Blueprint('integrations', __name__, url_prefix='/api/v1/integrations')
before_each(bp, handlers.integration_limits)
route(bp, 'POST', '/ingredients', handlers.ingredients)
route(bp, 'POST', '/recipe-import', handlers.import_recipe)
route(bp, 'POST', '/plan', handlers.plan)
route(bp, 'POST', '/shopping', handlers.shopping)
route(bp, 'GET', '/grocy', handlers.grocy)
route(bp, 'GET', '/mealie', handlers.mealie)
route(bp, 'GET', '/mealie-recipe', handlers.mealie_recipe)
route(bp, 'GET', '/exercises', handlers.exercises)
route(bp, 'GET', '/prices', handlers.prices)
route(bp, 'POST', '/transcribe', handlers.transcribe)
route(bp, 'POST', '/label', handlers.label)
route(bp, 'GET', '/status', handlers.status)
