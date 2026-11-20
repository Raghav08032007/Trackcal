"""Seed TrackCal standard recipes: cooked Indian dishes calculated from IFCT 2017 ingredients (data/standard_recipes.py).

Usage:  python scripts/seed_standard_recipes.py      (needs scripts/seed_ifct.py to have run first)

- Nutrients per 100 g cooked = sum over raw ingredients (IFCT per-100 g values x grams / 100) / cooked weight x 100.
- Stored as IFCT-sourced foods with external_id 'recipe:<slug>', so the IFCT launch gate covers them
  (docs/DATA_SOURCES.md: deleting data_source 'ifct' removes them too). Every value is marked as calculated
  (is_estimated) with a note; the food is not marked verified, because home recipes vary.
- A recipe whose ingredient is missing from the catalog is skipped and reported; nothing else is affected.
- Idempotent: re-running updates in place. Prints counts only.
"""
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import models  # noqa: E402
from data.standard_recipes import RECIPES, SUGAR, SUGAR_PER_100G  # noqa: E402
from database import SessionLocal  # noqa: E402

SLUGS = ('energy_kcal', 'protein', 'carbohydrates', 'fat', 'fiber')
NOTE = 'Calculated by TrackCal from IFCT 2017 ingredients (typical home recipe); home recipes vary'
PREFIX = 'recipe:'


def fold(text):
    """Text without accents or combining marks, as the database's collation compares it."""
    return ''.join(c for c in unicodedata.normalize('NFKD', text) if not unicodedata.combining(c))


def ingredient_values(db):
    """IFCT code -> {nutrient slug: amount per 100 g}, plus the IFCT name."""
    rows = (db.query(models.Food).filter(models.Food.data_source == models.NutritionDataSource.ifct, ~models.Food.external_id.like(PREFIX + '%')).all())
    return {f.external_id: ({n.nutrient_def.slug: n.amount_per_100g for n in f.nutrients if n.nutrient_def}, f.name) for f in rows}


def calculate(recipe, catalog):
    """Per 100 g cooked, and the ingredient names. Raises KeyError naming a missing ingredient."""
    totals = dict.fromkeys(SLUGS, 0.0); names = []
    for code, grams in recipe['ingredients']:
        if code == SUGAR: values, name = SUGAR_PER_100G, 'Sugar'
        else:
            if code not in catalog: raise KeyError(code)
            values, name = catalog[code]
        names.append(name)
        for slug in SLUGS:
            # A value the source does not give would make the dish look lighter than it is: skip the recipe instead.
            if values.get(slug) is None: raise KeyError(f'{code} has no {slug}')
            totals[slug] += values[slug] * grams / 100
    return {slug: round(total / recipe['cooked_g'] * 100, 3) for slug, total in totals.items()}, names


def seed(db):
    definitions = {d.slug: d for d in db.query(models.NutrientDefinition).filter(models.NutrientDefinition.slug.in_(SLUGS)).all()}
    catalog = ingredient_values(db)
    if not catalog: raise RuntimeError('No IFCT foods found: run scripts/seed_ifct.py first.')
    created = updated = 0; skipped = []
    for recipe in RECIPES:
        try: per100, names = calculate(recipe, catalog)
        except KeyError as missing: skipped.append(f"{recipe['slug']} (missing {missing.args[0]})"); continue
        food = db.query(models.Food).filter_by(data_source=models.NutritionDataSource.ifct, external_id=PREFIX + recipe['slug']).first()
        if food: updated += 1
        else:
            food = models.Food(data_source=models.NutritionDataSource.ifct, external_id=PREFIX + recipe['slug']); db.add(food); created += 1
        default_label, default_g = recipe['portions'][0]
        food.name, food.name_normalized = recipe['name'], re.sub(r'\s+', ' ', recipe['name'].lower()).strip()
        food.category, food.cuisine_region, food.is_verified, food.is_generic = recipe['category'], 'India', False, True
        food.serving_size_g, food.serving_size_unit, food.serving_size_description = default_g, 'g', default_label
        food.ingredients = list(dict.fromkeys(names))
        food.data_completeness_score = round(len(per100) / len(SLUGS), 2)
        current = {n.nutrient_def_id: n for n in food.nutrients}
        wanted = {definitions[slug].id: amount for slug, amount in per100.items() if slug in definitions}
        for def_id, amount in wanted.items():
            row = current.get(def_id) or models.FoodNutrient(nutrient_def_id=def_id)
            row.amount_per_100g, row.is_estimated, row.source_note = amount, True, NOTE
            if def_id not in current: food.nutrients.append(row)
        for def_id, row in current.items():
            if def_id not in wanted: food.nutrients.remove(row)
        db.flush()
        db.query(models.FoodPortion).filter_by(food_id=food.id).delete()
        for position, (label, grams) in enumerate(recipe['portions']): db.add(models.FoodPortion(food_id=food.id, label=label, grams=grams, position=position))
        current_names = {t.language_code: t for t in food.translations}
        for lang, text in recipe['names'].items():
            if lang in current_names: current_names[lang].name = text
            else: food.translations.append(models.FoodTranslation(language_code=lang, name=text))
        for lang, translation in current_names.items():
            if lang not in recipe['names']: food.translations.remove(translation)
        db.query(models.FoodAlias).filter_by(food_id=food.id).delete()
        # The database compares aliases ignoring accents and marks (खिचड़ी = खिचडी), so de-duplicate the same way.
        aliases = {}
        for alias in (a.lower()[:120] for a in [*recipe['aliases'], *recipe['names'].values()]): aliases.setdefault(fold(alias), alias)
        for alias in aliases.values(): db.add(models.FoodAlias(food_id=food.id, alias=alias))
    db.commit()
    return created, updated, skipped


def main():
    with SessionLocal() as db:
        created, updated, skipped = seed(db)
    print(f'standard recipes: {created} created, {updated} updated, {len(skipped)} skipped')
    for line in skipped: print('  skipped:', line)


if __name__ == '__main__':
    main()
