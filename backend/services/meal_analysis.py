"""Validates AI meal estimates and recomputes totals (server twin of frontend/web/src/lib/meal-analysis.ts).

Rejects empty, incomplete, negative, non-finite or implausible values instead of inventing nutrition.
Rounding follows JavaScript's Math.round (halves round up), not Python's banker's rounding.
A photo can't measure weight, so every component carries a portion range: the model's own low/high when it gives a
valid one ('model'), otherwise a band that widens as confidence falls ('confidence'). The meal carries the calorie range.
"""
import math


class MealAnalysisError(ValueError):
    pass


def _round1(value):
    return math.floor(value * 10 + 0.5) / 10


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _portion_range(item, quantity, confidence):
    low, high = item.get('quantity_g_low'), item.get('quantity_g_high')
    if _is_number(low) and _is_number(high) and 0 < low <= quantity <= high <= 10000:
        return [_round1(low), _round1(high)], 'model'
    width = 0.15 + 0.35 * (1 - confidence)  # 15% either side when certain, 50% when the model gives no confidence
    return [_round1(quantity * (1 - width)), _round1(quantity * (1 + width))], 'confidence'


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
        confidence = max(0, min(1, confidence)) if _is_number(confidence) else 0
        quantity, calories = number('quantity_g', 10000), number('calories', 20000)
        portion_range, basis = _portion_range(item, quantity, confidence)
        components.append({'name': item['name'].strip()[:160], 'quantity_g': quantity, 'calories': calories,
                           'protein_g': number('protein_g', 2000), 'carbs_g': number('carbs_g', 2000), 'fat_g': number('fat_g', 2000),
                           'confidence': confidence, 'portion_range_g': portion_range, 'range_basis': basis,
                           'calorie_range': [_round1(calories * portion_range[0] / quantity), _round1(calories * portion_range[1] / quantity)]})
    total = {key: _round1(sum(c[key] for c in components)) for key in ('calories', 'protein_g', 'carbs_g', 'fat_g')}
    dish = root.get('dish_name')
    return {'dish_name': dish[:200] if isinstance(dish, str) else ', '.join(c['name'] for c in components),
            'components': components, 'total_nutrition': total, 'model': model, 'is_mock': False,
            'calorie_range': [_round1(sum(c['calorie_range'][i] for c in components)) for i in (0, 1)]}
