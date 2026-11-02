"""Validates AI meal estimates and recomputes totals (server twin of frontend/web/src/lib/meal-analysis.ts).

Rejects empty, incomplete, negative, non-finite or implausible values instead of inventing nutrition.
Rounding follows JavaScript's Math.round (halves round up), not Python's banker's rounding.
A photo can't measure weight, so every component carries a portion range: the model's own low/high when it gives a
valid one ('model'), otherwise a band that widens as confidence falls ('confidence'). The meal carries the calorie range.
When the model gives count and grams_each, and per_100g with edible_pct, weight and nutrition are worked out here, so the
calories always follow from the grams. Older replies with only portion totals still work.
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


def _energy_checked(per):
    """Calories must agree with the macros (Atwater: 4, 4, 9). A claim far from them is a model slip, so the macros win.
    Alcohol and sugar alcohols carry calories macros don't show, so only a large gap on food with real macros is corrected."""
    worked = 4 * per['protein_g'] + 4 * per['carbs_g'] + 9 * per['fat_g']
    if worked >= 20 and abs(per['calories'] - worked) / worked > .3: return {**per, 'calories': round(worked, 1)}, True
    return per, False


def ground_in_catalog(raw, lookup):
    """Swaps the model's per-100 g for official values on single foods, only when both agree within 35% on calories.
    A bigger gap means the match is the wrong state of the food, like raw rice for boiled, so the model's value stays."""
    root = raw if isinstance(raw, dict) else {}
    items = raw if isinstance(raw, list) else root.get('components') if root.get('components') is not None else root.get('items')
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict) or not isinstance(item.get('name'), str): continue
        per, parts = item.get('per_100g'), item.get('ingredients')
        if not isinstance(per, dict) or not _is_number(per.get('calories')) or per['calories'] <= 0: continue
        if isinstance(parts, list) and len(parts) > 1: continue
        try: found = lookup(item['name'])
        except Exception: continue
        if not found or not _is_number(found.get('calories')) or abs(found['calories'] - per['calories']) / per['calories'] > .35: continue
        item['per_100g'] = {key: found[key] for key in ('calories', 'protein_g', 'carbs_g', 'fat_g')}
        item['nutrition_source'] = found.get('source') or 'TrackCal catalog'
    return raw


def _weighed(item):
    """Count times weight, then nutrition from the part that is eaten. Anything missing or implausible keeps the model's totals."""
    worked, count, each = dict(item), item.get('count'), item.get('grams_each')
    if _is_number(count) and _is_number(each) and 1 <= count <= 200 and each > 0 and count * each <= 10000:
        worked['count'], worked['grams_each'] = int(count) if float(count).is_integer() else count, _round1(each)
        old, worked['quantity_g'] = item.get('quantity_g'), count * each
        if _is_number(old) and old > 0:  # the range moves with the corrected weight
            for key in ('quantity_g_low', 'quantity_g_high'):
                if _is_number(item.get(key)): worked[key] = item[key] * worked['quantity_g'] / old
    per = item.get('per_100g') if isinstance(item.get('per_100g'), dict) else {}
    limits = {'calories': 900, 'protein_g': 100, 'carbs_g': 100, 'fat_g': 100}
    edible = item.get('edible_pct', 100)
    quantity = worked.get('quantity_g')
    if all(_is_number(per.get(key)) and 0 <= per[key] <= limit for key, limit in limits.items()) and _is_number(edible) and 5 <= edible <= 100 and _is_number(quantity):
        worked['edible_g'] = _round1(quantity * edible / 100)
        per, corrected = _energy_checked(per)
        if corrected: worked['energy_corrected'] = True
        for key in limits: worked[key] = per[key] * worked['edible_g'] / 100
    return worked


def _ingredients(item):
    rows = item.get('ingredients') if isinstance(item.get('ingredients'), list) else []
    return [{'name': row['name'].strip()[:80], 'grams': _round1(row['grams'])} for row in rows[:20]
            if isinstance(row, dict) and isinstance(row.get('name'), str) and row['name'].strip() and _is_number(row.get('grams')) and 0 <= row['grams'] <= 10000]


def normalize_menu(raw):
    """Dishes read off a menu. Anything incomplete or impossible is dropped, never guessed at."""
    rows = raw.get('dishes') if isinstance(raw, dict) else None
    dishes = []
    for row in rows[:60] if isinstance(rows, list) else []:
        if not isinstance(row, dict) or not isinstance(row.get('name'), str) or not row['name'].strip(): continue
        per = {key: row.get(key) for key in ('calories', 'protein_g', 'carbs_g', 'fat_g')}
        if not all(_is_number(value) and value >= 0 for value in per.values()) or not 0 < per['calories'] <= 3000 or max(per['protein_g'], per['carbs_g'], per['fat_g']) > 400: continue
        per, _ = _energy_checked(per)
        dishes.append({'name': row['name'].strip()[:120], **{key: _round1(value) for key, value in per.items()}, 'vegetarian': row['vegetarian'] if isinstance(row.get('vegetarian'), bool) else None})
    return dishes


def normalize_meal(raw, model):
    root = raw if isinstance(raw, dict) else {}
    items = raw if isinstance(raw, list) else root.get('components') if root.get('components') is not None else root.get('items')
    if not isinstance(items, list) or not items or len(items) > 30:
        raise MealAnalysisError('No readable food found. Try a clearer photo or describe the meal.')
    components = []
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get('name'), str) or not item['name'].strip():
            raise MealAnalysisError('Invalid food response.')
        item = _weighed(item)

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
                           'count': item.get('count') if 'grams_each' in item and _is_number(item.get('grams_each')) else None, 'grams_each': item.get('grams_each') if _is_number(item.get('grams_each')) else None,
                           'edible_g': item.get('edible_g'), 'nutrition_source': item.get('nutrition_source') or 'AI estimate', 'energy_corrected': bool(item.get('energy_corrected')), 'ingredients': _ingredients(item),
                           'calorie_range': [_round1(calories * portion_range[0] / quantity), _round1(calories * portion_range[1] / quantity)]})
    total = {key: _round1(sum(c[key] for c in components)) for key in ('calories', 'protein_g', 'carbs_g', 'fat_g')}
    dish = root.get('dish_name')
    return {'dish_name': dish[:200] if isinstance(dish, str) else ', '.join(c['name'] for c in components),
            'components': components, 'total_nutrition': total, 'model': model, 'is_mock': False,
            'calorie_range': [_round1(sum(c['calorie_range'][i] for c in components)) for i in (0, 1)]}
