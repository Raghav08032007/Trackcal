"""Validates AI meal estimates and recomputes totals (server twin of frontend/web/src/lib/meal-analysis.ts).

Rejects empty, incomplete, negative, non-finite or implausible values instead of inventing nutrition.
Rounding follows JavaScript's Math.round (halves round up), not Python's banker's rounding.
"""
import math


class MealAnalysisError(ValueError):
    pass


def _round1(value):
    return math.floor(value * 10 + 0.5) / 10


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def normalize_meal(raw, model):
    root = raw if isinstance(raw, dict) else {}
    items = raw if isinstance(raw, list) else root.get('components') if root.get('components') is not None else root.get('items')
    if not isinstance(items, list) or not items or len(items) > 30:
        raise MealAnalysisError('No readable food found. Try a clearer photo or describe the meal.')
    components = []
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get('name'), str) or not item['name'].strip():
            raise MealAnalysisError('Invalid food response.')

        def number(key, maximum):
            value = item.get(key)
            if not _is_number(value) or value < 0 or value > maximum:
                raise MealAnalysisError('Incomplete nutrition response. Please retry or enter your meal manually.')
            if key == 'quantity_g' and value <= 0: raise MealAnalysisError('The portion estimate is missing. Retry or log manually.')
            return _round1(value)

        confidence = item.get('confidence')
        components.append({'name': item['name'].strip()[:160], 'quantity_g': number('quantity_g', 10000), 'calories': number('calories', 20000),
                           'protein_g': number('protein_g', 2000), 'carbs_g': number('carbs_g', 2000), 'fat_g': number('fat_g', 2000),
                           'confidence': max(0, min(1, confidence)) if _is_number(confidence) else 0})
    total = {key: _round1(sum(c[key] for c in components)) for key in ('calories', 'protein_g', 'carbs_g', 'fat_g')}
    dish = root.get('dish_name')
    return {'dish_name': dish[:200] if isinstance(dish, str) else ', '.join(c['name'] for c in components),
            'components': components, 'total_nutrition': total, 'model': model, 'is_mock': False}
