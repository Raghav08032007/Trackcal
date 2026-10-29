"""Seed the food catalog from IFCT 2017 (Indian Food Composition Tables, National Institute of Nutrition, Hyderabad).

Usage:  python scripts/seed_ifct.py            (downloads the pinned package into backend/runtime/ifct/)
        python scripts/seed_ifct.py --csv PATH  (use an index.csv you already have)

- Data: @ifct2017/compositions 2.0.9 (packaging code MIT). The values belong to ICMR-NIN; written permission
  is a launch gate (docs/DATA_SOURCES.md). The data is never committed to this repository.
- The download is verified against the npm registry's published sha512 before it is read.
- Idempotent: foods are upserted by (source 'ifct', IFCT food code); re-running updates in place.
- Per 100 g edible portion. Energy converted from kJ. A missing value creates no nutrient row (unknown, never 0).
- Local names (Hindi, Tamil, Telugu, ...) become translations and search aliases.
Prints counts only.
"""
import argparse, base64, csv, hashlib, io, json, re, sys, tarfile, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import models  # noqa: E402
from database import SessionLocal  # noqa: E402

PACKAGE, VERSION = "@ifct2017/compositions", "2.0.9"
SOURCE_NOTE = "IFCT 2017, National Institute of Nutrition, Hyderabad"
# IFCT local-name prefixes -> language codes.
LANGUAGES = {"A": "as", "B": "bn", "E": "en", "G": "gu", "H": "hi", "Kan": "kn", "Kash": "ks", "Kh": "kha", "Kon": "kok", "Mal": "ml",
             "M": "mni", "Mar": "mr", "N": "ne", "O": "or", "P": "pa", "S": "sa", "Tam": "ta", "Tel": "te", "U": "ur"}
# Our nutrient slug -> (IFCT column, unit conversion).
NUTRIENTS = {"energy_kcal": ("enerc", 1 / 4.184), "protein": ("protcnt", 1.0), "fat": ("fatce", 1.0), "carbohydrates": ("choavldf", 1.0), "fiber": ("fibtg", 1.0)}


def download(cache: Path) -> bytes:
    meta = json.load(urllib.request.urlopen(f"https://registry.npmjs.org/{PACKAGE.replace('/', '%2f')}/{VERSION}", timeout=30))
    algorithm, expected = meta["dist"]["integrity"].split("-", 1)
    if algorithm != "sha512": raise RuntimeError(f"Unexpected integrity algorithm {algorithm}")
    cache.mkdir(parents=True, exist_ok=True)
    tarball = cache / f"compositions-{VERSION}.tgz"
    if not tarball.exists(): tarball.write_bytes(urllib.request.urlopen(meta["dist"]["tarball"], timeout=60).read())
    data = tarball.read_bytes()
    if base64.b64encode(hashlib.sha512(data).digest()).decode() != expected:
        tarball.unlink(); raise RuntimeError("Downloaded package failed its integrity check; nothing was imported.")
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        return archive.extractfile("package/index.csv").read()


def column_names(header):
    return [cell.split(";")[-1].strip() for cell in header]  # "Energy; enerc" -> "enerc"


def number(value):
    try: result = float(value)
    except (TypeError, ValueError): return None
    return result if result >= 0 else None


def local_names(text):
    """'H. Chawal; Tam. Arisi, Arisi Sadham.' -> {'hi': ['Chawal'], 'ta': ['Arisi', 'Arisi Sadham']}"""
    names = {}
    for part in (text or "").rstrip(".").split(";"):
        match = re.match(r"\s*([A-Za-z]+)\.\s*(.+)", part)
        if not match or match.group(1) not in LANGUAGES: continue
        for name in re.split(r"\s*[,/]\s*", match.group(2)):
            name = name.strip().strip(".")
            if 1 < len(name) <= 100: names.setdefault(LANGUAGES[match.group(1)], []).append(name)
    return names


def seed(rows, db):
    definitions = {d.slug: d for d in db.query(models.NutrientDefinition).filter(models.NutrientDefinition.slug.in_(NUTRIENTS)).all()}
    missing = set(NUTRIENTS) - set(definitions)
    if missing: raise RuntimeError(f"Nutrient definitions missing: {sorted(missing)} (run seed_data.py first)")
    created = updated = 0
    for row in rows:
        code, name = row["code"].strip(), row["name"].strip()
        if not code or not name: continue
        food = db.query(models.Food).filter_by(data_source=models.NutritionDataSource.ifct, external_id=code).first()
        if food: updated += 1
        else:
            food = models.Food(data_source=models.NutritionDataSource.ifct, external_id=code); db.add(food); created += 1
        values = {slug: number(row.get(column)) for slug, (column, _) in NUTRIENTS.items()}
        food.name, food.name_normalized = name, re.sub(r"\s+", " ", name.lower()).strip()
        food.category, food.cuisine_region, food.is_verified, food.is_generic = row.get("grup") or None, "India", True, True
        food.serving_size_g, food.serving_size_unit, food.serving_size_description = 100, "g", "100 g edible portion"
        food.data_completeness_score = round(sum(v is not None for v in values.values()) / len(values), 2)
        # Update rows in place by their unique keys: replacing the collections would insert before deleting
        # and collide with the (food, nutrient) and (food, language) unique constraints on a re-run.
        amounts = {slug: value * NUTRIENTS[slug][1] for slug, value in values.items() if value is not None}
        notes = {slug: (False, SOURCE_NOTE) for slug in amounts}
        # IFCT 2017 publishes 0 kJ for oils, ghee and vanaspati (14 foods): 0 there means "not given", which would log
        # cooking fat as 0 kcal. When energy is missing, or 0 while the macronutrients clearly contain energy, use the
        # Atwater estimate (4/4/9 kcal per g) and mark it as an estimate with how it was derived.
        if all(slug in amounts for slug in ("protein", "carbohydrates", "fat")):
            atwater = 4 * amounts["protein"] + 4 * amounts["carbohydrates"] + 9 * amounts["fat"]
            if amounts.get("energy_kcal") is None or (amounts["energy_kcal"] == 0 and atwater >= 20):
                amounts["energy_kcal"] = atwater
                notes["energy_kcal"] = (True, "Calculated from protein, carbohydrate and fat (Atwater 4/4/9); IFCT 2017 lists no energy value")
        wanted = {definitions[slug].id: (round(amount, 3), *notes[slug]) for slug, amount in amounts.items()}
        current = {n.nutrient_def_id: n for n in food.nutrients}
        for def_id, (amount, estimated, note) in wanted.items():
            row_n = current.get(def_id) or models.FoodNutrient(nutrient_def_id=def_id)
            row_n.amount_per_100g, row_n.is_estimated, row_n.source_note = amount, estimated, note
            if def_id not in current: food.nutrients.append(row_n)
        for def_id, row_n in current.items():
            if def_id not in wanted: food.nutrients.remove(row_n)  # value no longer published: unknown again
        names = local_names(row.get("lang"))
        wanted_names = {lang: " / ".join(dict.fromkeys(items))[:255] for lang, items in names.items()}
        current_names = {t.language_code: t for t in food.translations}
        for lang, text_ in wanted_names.items():
            if lang in current_names: current_names[lang].name = text_
            else: food.translations.append(models.FoodTranslation(language_code=lang, name=text_))
        for lang, translation in current_names.items():
            if lang not in wanted_names: food.translations.remove(translation)
        aliases = dict.fromkeys(alias.lower()[:120] for items in names.values() for alias in items)
        db.flush(); db.query(models.FoodAlias).filter_by(food_id=food.id).delete()
        for alias in aliases: db.add(models.FoodAlias(food_id=food.id, alias=alias))
    db.commit()
    return created, updated


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0]); parser.add_argument("--csv", type=Path)
    args = parser.parse_args()
    raw = args.csv.read_bytes() if args.csv else download(ROOT / "runtime" / "ifct")
    reader = csv.reader(io.StringIO(raw.decode("utf-8")))
    names = column_names(next(reader))
    rows = [dict(zip(names, cells)) for cells in reader if cells]
    with SessionLocal() as db: created, updated = seed(rows, db)
    print(f"IFCT 2017: {len(rows)} rows read, {created} foods created, {updated} updated. Source: {SOURCE_NOTE}.")


if __name__ == "__main__":
    main()
