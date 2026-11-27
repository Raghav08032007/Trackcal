"""Import the USDA FoodData Central datasets into the food catalog: whole foods, ingredients and prepared dishes.

Usage:  python scripts/import_usda.py            (downloads into backend/runtime/usda/)
        python scripts/import_usda.py --dir PATH  (use the zip files you already have)

- Data: FoodData Central, U.S. Department of Agriculture. Public domain (CC0); open data, not scraped pages.
- Foundation Foods, SR Legacy and the Survey foods (FNDDS, which has prepared dishes and their ingredients).
- Idempotent: foods are upserted by (source 'usda', FDC id), so re-running after a new USDA release updates in place.
- Per 100 g. A missing value creates no nutrient row (unknown, never 0). Foods without energy and all three
  macronutrients are skipped, because they can't give a calorie figure.
Prints counts only.
"""
import argparse, json, re, sys, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import models  # noqa: E402
from database import SessionLocal  # noqa: E402

BASE = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_"
DATASETS = ("foundation_food_json_2024-10-31", "sr_legacy_food_json_2018-04", "survey_food_json_2024-10-31")
SOURCE_NOTE = "USDA FoodData Central"
# Our nutrient slug -> USDA nutrient ids, best first. Foundation foods often give energy only as Atwater values.
NUTRIENTS = {"energy_kcal": (1008, 2047, 2048), "protein": (1003,), "fat": (1004,), "carbohydrates": (1005, 1050), "fiber": (1079,), "sugar": (2000,), "sodium": (1093,)}
# Vitamins and minerals (FoodData Central nutrient ids; already in mg or micrograms per 100 g, like our definitions).
NUTRIENTS.update({"calcium": (1087,), "iron": (1089,), "magnesium": (1090,), "potassium": (1092,), "zinc": (1095,),
                  "vitamin_c": (1162,), "vitamin_d": (1114,), "vitamin_b12": (1178,), "folate": (1177, 1190),
                  "cholesterol": (1253,), "saturated_fat": (1258,)})
CORE = ("energy_kcal", "protein", "fat", "carbohydrates", "fiber", "sugar", "sodium")
REQUIRED = ("energy_kcal", "protein", "fat", "carbohydrates")
MAX_PORTIONS, MAX_INGREDIENTS = 12, 20


def records(path):
    with zipfile.ZipFile(path) as archive:
        data = json.loads(archive.read(archive.namelist()[0]))
    return next(value for value in data.values() if isinstance(value, list))


def amounts(food):
    found = {}
    for row in food.get("foodNutrients") or []:
        amount = row.get("amount")
        if isinstance(amount, (int, float)) and amount >= 0: found.setdefault((row.get("nutrient") or {}).get("id"), amount)
    return {slug: next(found[i] for i in ids if i in found) for slug, ids in NUTRIENTS.items() if any(i in found for i in ids)}


def portion_label(row):
    described = (row.get("portionDescription") or "").strip()
    if described: return described
    unit = ((row.get("measureUnit") or {}).get("name") or "").strip()
    unit = "" if unit == "undetermined" else unit
    amount = row.get("amount") or row.get("value") or 1
    return re.sub(r"\s+", " ", f"{amount:g} {unit} {row.get('modifier') or ''}").strip()


def portions(food):
    seen, result = set(), []
    for row in sorted(food.get("foodPortions") or [], key=lambda item: item.get("sequenceNumber") or 0):
        label, grams = portion_label(row)[:120], row.get("gramWeight")
        if not label or label.lower() == "quantity not specified" or label.lower() in seen: continue
        if isinstance(grams, (int, float)) and 0 < grams <= 5000:
            seen.add(label.lower()); result.append((label, float(grams)))
    return result[:MAX_PORTIONS]


def ingredients(food):
    rows = [(row.get("ingredientDescription") or "").strip() for row in food.get("inputFoods") or []]
    return list(dict.fromkeys(name for name in rows if name))[:MAX_INGREDIENTS] or None


def category(food):
    return ((food.get("foodCategory") or {}).get("description") or (food.get("wweiaFoodCategory") or {}).get("wweiaFoodCategoryDescription") or None)


def run(rows, db):
    definitions = {d.slug: d.id for d in db.query(models.NutrientDefinition).filter(models.NutrientDefinition.slug.in_(NUTRIENTS)).all()}
    missing = set(REQUIRED) - set(definitions)
    if missing: raise RuntimeError(f"Nutrient definitions missing: {sorted(missing)} (run seed_data.py first)")
    existing = dict(db.query(models.Food.external_id, models.Food.id).filter(models.Food.data_source == models.NutritionDataSource.usda))
    created = updated = skipped = 0
    for index, food in enumerate(rows, 1):
        values, name, fdc = amounts(food), (food.get("description") or "").strip()[:255], str(food.get("fdcId") or "")
        values = {slug: value for slug, value in values.items() if slug in definitions}
        if not name or not fdc or any(slug not in values for slug in REQUIRED) or values["energy_kcal"] > 950:
            skipped += 1; continue
        row = db.get(models.Food, existing[fdc]) if fdc in existing else None
        if row:
            updated += 1; row.nutrients.clear(); row.portions.clear(); db.flush()
        else:
            row = models.Food(data_source=models.NutritionDataSource.usda, external_id=fdc); db.add(row); created += 1
        row.name, row.name_normalized = name, re.sub(r"\s+", " ", name.lower()).strip()[:255]
        row.category, row.is_verified, row.is_generic, row.ingredients = (category(food) or "")[:100] or None, True, True, ingredients(food)
        row.serving_size_g, row.serving_size_unit, row.serving_size_description = 100, "g", "100 g"
        row.data_completeness_score = round(sum(k in values for k in CORE) / len(CORE), 2)
        row.nutrients = [models.FoodNutrient(nutrient_def_id=definitions[slug], amount_per_100g=round(value, 3), source_note=SOURCE_NOTE) for slug, value in values.items()]
        row.portions = [models.FoodPortion(label=label, grams=grams, position=i) for i, (label, grams) in enumerate(portions(food))]
        if index % 500 == 0: db.commit()
    db.commit()
    return created, updated, skipped


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--dir"); options = parser.parse_args()
    folder = Path(options.dir) if options.dir else ROOT / "runtime" / "usda"
    folder.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        for dataset in DATASETS:
            path = folder / f"FoodData_Central_{dataset}.zip"
            if not path.exists(): urllib.request.urlretrieve(f"{BASE}{dataset}.zip", path)
            print(dataset, "created %d, updated %d, skipped %d" % run(records(path), db))
        print("foods from USDA:", db.query(models.Food).filter(models.Food.data_source == models.NutritionDataSource.usda).count())


if __name__ == "__main__":
    main()
