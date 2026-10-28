"""Recipes endpoints under /api/v1/recipes."""
from flask import Blueprint

from flask_app import before_each, route
from routers import recipes as handlers

bp = Blueprint('recipes', __name__, url_prefix='/api/v1/recipes')
route(bp, 'POST', '', handlers.create_recipe, status=201)
route(bp, 'GET', '', handlers.list_recipes)
route(bp, 'GET', '/<recipe_id>', handlers.get_recipe)
route(bp, 'DELETE', '/<recipe_id>', handlers.delete_recipe)
