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
    """Every word must match. Names that start with the first word and shorter, plainer names come first."""
    term = query.strip().lower()
    words = [word for word in re.findall(r'\w+', term, flags=re.UNICODE) if len(word) >= 3]
    aliases = db.query(models.FoodTranslation.food_id).filter(models.FoodTranslation.name.like(f'%{term}%'))
    matches = [models.Food.id.in_(aliases), models.Food.name_normalized.like(f'{term}%')]
    if words: matches.append(text('MATCH (foods.name) AGAINST (:terms IN BOOLEAN MODE)').bindparams(terms=' '.join(f'+{word}*' for word in words)))
    first = (words or [term])[0]
    word = re.escape(first)  # whole words first, so roti finds roti before rotisserie chicken
    rank = case((models.Food.name_normalized == term, 0), (models.Food.name_normalized.op('REGEXP')(f'^{word}\\b'), 1), (models.Food.name_normalized.op('REGEXP')(f'\\b{word}\\b'), 2), else_=3)
    rows = db.query(models.Food).options(selectinload(models.Food.nutrients).selectinload(models.FoodNutrient.nutrient_def), selectinload(models.Food.portions)) \
        .filter(or_(*matches)).order_by(rank, func.char_length(models.Food.name), models.Food.id).limit(limit).all()
    return [view for view in map(_view, rows) if view]
