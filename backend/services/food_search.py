"""Catalog search for the food library: results carry nutrition per 100 g, real serving sizes and ingredients."""
import re

from sqlalchemy import case, func, or_, text
from sqlalchemy.orm import selectinload

import models

SOURCES = {models.NutritionDataSource.usda: 'USDA FoodData Central', models.NutritionDataSource.ifct: 'IFCT 2017',
           models.NutritionDataSource.open_food_facts: 'Open Food Facts'}


def _view(food):
    values = {row.nutrient_def.slug: row.amount_per_100g for row in food.nutrients if row.nutrient_def}
    if any(values.get(slug) is None for slug in ('energy_kcal', 'protein', 'carbohydrates', 'fat')): return None
    return {'id': food.id, 'name': food.name, 'cuisine': food.cuisine_region or food.category or 'Food', 'category': food.category or 'Food', 'serving_size': '100g',
            'calories': round(values['energy_kcal'], 1), 'protein': round(values['protein'], 1), 'carbs': round(values['carbohydrates'], 1), 'fat': round(values['fat'], 1),
            'fiber': round(values.get('fiber') or 0, 1), 'source': SOURCES.get(food.data_source, 'TrackCal catalog'), 'verified': bool(food.is_verified), 'allergens': [],
            'portions': [{'label': row.label, 'grams': row.grams} for row in sorted(food.portions, key=lambda item: item.position)], 'ingredients': food.ingredients or []}


def search(db, query, limit=30):
    """The food library: the same ranking as the diary search (services/food_rank.py), with full nutrition and portions."""
    from services.food_rank import find
    rows, _, _ = find(db, query, limit=limit)
    return [view for view in map(_view, rows[:limit]) if view]
