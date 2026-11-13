"""Phase E: the food a person means comes first. Made-up foods (prefix qz) keep these independent of the real catalog."""
import database, models
from tests.test_adventure import account
from tests.test_food_search import add_food, search


def names(headers, q):
    return [r['name'] for r in search(headers, q).json()['results']]


def test_the_plain_food_comes_before_processed_variants():
    _, h = account()
    with database.SessionLocal() as db:
        add_food(db, 'Qzegg, white, dried'); add_food(db, 'Qzegg, white, raw, fresh'); add_food(db, 'Qzcoco oil'); add_food(db, 'Qzcoco, kernel, fresh')
        add_food(db, 'Qzcheese, mozzarella, nonfat'); add_food(db, 'Qzcheese, mozzarella, whole milk'); db.commit()
    assert names(h, 'qzegg white')[0] == 'Qzegg, white, raw, fresh'
    assert names(h, 'qzcoco')[0] == 'Qzcoco, kernel, fresh'
    assert names(h, 'qzcheese mozzarella')[0] == 'Qzcheese, mozzarella, whole milk'


def test_a_cooking_word_that_was_typed_must_be_in_the_name():
    _, h = account()
    with database.SessionLocal() as db:
        add_food(db, 'Qzspud, raw'); add_food(db, 'Qzspud, boiled, fat added'); add_food(db, 'Qzspud, cooked, boiled, without skin'); db.commit()
    assert names(h, 'qzspud boiled')[0] == 'Qzspud, cooked, boiled, without skin'
    assert names(h, 'qzspud')[0] == 'Qzspud, raw'                          # nothing about cooking typed: the food as bought


def test_names_written_the_other_way_round_and_plurals_match():
    _, h = account()
    with database.SessionLocal() as db:
        add_food(db, 'Qzmilk, whole'); add_food(db, 'Qzwhole qzmilk (cup)'); add_food(db, 'Qzpista nuts, dry roasted'); db.commit()
    assert names(h, 'whole qzmilk')[0] == 'Qzmilk, whole'
    assert names(h, 'qzpistas')[0] == 'Qzpista nuts, dry roasted'


def test_local_names_whole_or_word_by_word_reach_the_basic_food():
    _, h = account()
    with database.SessionLocal() as db:
        add_food(db, 'Qzspinach, raw'); add_food(db, 'Qzpalak qzpaneer', aliases=['qzpalak qzpaneer']); add_food(db, 'Qzoats, cooked')
        db.add(models.SearchSynonym(term='qzpalak', canonical='qzspinach')); db.add(models.SearchSynonym(term='qzoatmeal', canonical='qzoats')); db.commit()
    assert names(h, 'qzpalak')[0] == 'Qzspinach, raw'
    body = search(h, 'cooked qzoatmeal').json()
    assert body['matched_term'] == 'cooked qzoats' and body['results'][0]['name'] == 'Qzoats, cooked'


def test_favourites_still_come_first():
    user_id, h = account()
    with database.SessionLocal() as db:
        add_food(db, 'Qzrice, raw'); favourite = add_food(db, 'Qzrice, cooked, with salt')
        db.add(models.FoodFavorite(user_id=user_id, food_key=favourite, snapshot={'name': 'Qzrice, cooked, with salt'})); db.commit()
    assert names(h, 'qzrice')[0] == 'Qzrice, cooked, with salt'
