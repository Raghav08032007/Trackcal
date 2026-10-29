"""Phase 2 (C): spelling variants, local names, word-anywhere matches, ranking and hostile input."""
import uuid
from datetime import datetime

import pytest
from sqlalchemy.orm import Session

import database, models
from tests.test_adventure import account, client


def energy(db):
    return db.query(models.NutrientDefinition).filter_by(slug="energy_kcal").first()


def add_food(db, name, verified=False, source=models.NutritionDataSource.usda, translations=(), aliases=()):
    food = models.Food(name=name, name_normalized=name.lower(), data_source=source, is_verified=verified, serving_size_g=100)
    db.add(food); db.flush()
    db.add(models.FoodNutrient(food_id=food.id, nutrient_def_id=energy(db).id, amount_per_100g=100))
    for lang, text in translations: db.add(models.FoodTranslation(food_id=food.id, language_code=lang, name=text))
    for alias in aliases: db.add(models.FoodAlias(food_id=food.id, alias=alias))
    db.flush(); return food.id


def search(headers, q, **params):
    return client.get("/api/v1/wellness/foods", headers=headers, params={"q": q, **params})


@pytest.mark.parametrize("typed,canonical", [("idly", "idli"), ("dosai", "dosa"), ("thayir", "curd"), ("chapathi", "chapati")])
def test_spelling_variants_come_from_the_synonym_table(typed, canonical):
    _, h = account()
    assert search(h, typed).json()["matched_term"] == canonical


def test_local_names_find_the_food_and_say_which_language_matched():
    _, h = account()
    with database.SessionLocal() as db:
        ragi = add_food(db, "Qa Finger Millet Grain", verified=True, source=models.NutritionDataSource.ifct,
                        translations=[("ta", "Qakelvaragu"), ("hi", "Qaragi")], aliases=["qakelvaragu", "qaragi"]); db.commit()
    hit = next(r for r in search(h, "qakelvaragu").json()["results"] if r["id"] == ragi)
    assert hit["matched_name"] == "Qakelvaragu (Tamil)"
    assert hit["source_label"] == "IFCT 2017, National Institute of Nutrition, Hyderabad"


def test_word_anywhere_in_a_name_is_found_by_the_full_text_index():
    # InnoDB full-text indexes only see committed rows, so this test commits its own food (before the test
    # transaction's first read, which fixes its snapshot) and removes it afterwards.
    marker = f"zqmilled{uuid.uuid4().hex[:6]}"
    with Session(database.engine) as db:
        food = add_food(db, f"Qa rice, raw, {marker}"); db.commit()
    try:
        _, h = account()
        assert any(r["id"] == food for r in search(h, marker).json()["results"])
    finally:
        with Session(database.engine) as db:
            db.query(models.Food).filter_by(id=food).delete(); db.commit()


def test_ranking_favourites_then_recent_then_verified():
    owner, h = account()
    with database.SessionLocal() as db:
        plain = add_food(db, "Qarank plain"); verified = add_food(db, "Qarank verified", verified=True)
        recent = add_food(db, "Qarank recent"); favourite = add_food(db, "Qarank favourite")
        db.add(models.FoodFavorite(user_id=owner, food_key=favourite, snapshot={}))
        log = models.MealLog(user_id=owner, logged_at=datetime.utcnow(), meal_type=models.MealType.lunch); db.add(log); db.flush()
        db.add(models.MealItem(meal_log_id=log.id, food_id=recent, display_name="Qarank recent", quantity_g=100, calories=100)); db.commit()
    ids = [r["id"] for r in search(h, "qarank").json()["results"]]
    assert ids.index(favourite) < ids.index(recent) < ids.index(verified) < ids.index(plain)


@pytest.mark.parametrize("q", ["%", "_", "'", "\\", "' OR 1=1 --", "+rice -dal", "rice*", '"rice"', "(dal)", "@rice"])
def test_special_characters_are_safe(q):
    _, h = account()
    response = search(h, q)
    assert response.status_code == 200 and isinstance(response.json()["results"], list)


def test_empty_and_overlong_queries():
    _, h = account()
    assert search(h, "").status_code == 200
    assert search(h, "x" * 101).status_code == 422


def test_typed_word_still_matches_when_its_synonym_differs_from_the_catalog_name():
    # IFCT names the food "Ragi" while the synonym table maps ragi -> "finger millet": both must be searched.
    _, h = account()
    with database.SessionLocal() as db:
        db.add(models.SearchSynonym(term="qazragi", canonical="qaz finger millet"))
        ragi = add_food(db, "Qazragi"); db.commit()
    body = search(h, "qazragi").json()
    assert body["matched_term"] == "qaz finger millet"
    assert any(r["id"] == ragi for r in body["results"])
