"""TrackCal standard recipes (cooked Indian dishes calculated from IFCT 2017 ingredients) and the IFCT energy check.

- The arithmetic: per 100 g cooked = the raw ingredients' nutrients / cooked weight.
- Plausibility: calories per everyday portion fall inside commonly published ranges, so a wrong recipe assumption
  (too much oil, wrong cooked weight) fails here instead of reaching people.
- Search finds dishes by everyday spellings and local names; values are marked as calculated, never as verified.
- IFCT energy that its own macronutrients cannot supply is corrected (chicken leg, skinless)."""
import pytest

import database
import models
from data.standard_recipes import RECIPES, SUGAR
from scripts import seed_standard_recipes as seeder
from services.food_search import RECIPE_SOURCE, search


@pytest.fixture(scope='module')
def db():
    with database.SessionLocal() as session:
        if not seeder.ingredient_values(session): pytest.skip('IFCT foods are not seeded in this database (scripts/seed_ifct.py)')
        seeder.seed(session)
        yield session


def dish(db, slug):
    return db.query(models.Food).filter_by(external_id='recipe:' + slug).one()


def values(food):
    return {n.nutrient_def.slug: n.amount_per_100g for n in food.nutrients}


def per_portion(db, slug):
    food = dish(db, slug)
    return values(food)['energy_kcal'] * food.serving_size_g / 100


def test_every_recipe_is_well_formed_and_uses_catalog_ingredients(db):
    catalog = seeder.ingredient_values(db)
    slugs = [r['slug'] for r in RECIPES]
    assert len(slugs) == len(set(slugs)) and len(RECIPES) >= 80
    for r in RECIPES:
        raw = sum(g for _, g in r['ingredients'])
        assert r['portions'] and all(g > 0 for _, g in r['portions']), r['slug']
        assert 0.4 * raw <= r['cooked_g'] <= 6 * raw, r['slug']            # cooking adds or removes water within reason
        assert all(code == SUGAR or code in catalog for code, _ in r['ingredients']), r['slug']


def test_the_arithmetic_matches_the_ingredients(db):
    catalog = seeder.ingredient_values(db)
    rice, urad = catalog['A014'][0], catalog['B003'][0]
    expected = (rice['energy_kcal'] * 75 / 100 + urad['energy_kcal'] * 25 / 100) / 250 * 100   # idli: 75 g rice, 25 g urad dal -> 250 g
    assert values(dish(db, 'idli'))['energy_kcal'] == pytest.approx(expected, rel=1e-3)


# Calories for one everyday portion, as commonly published for home-style dishes (wide on purpose: recipes vary).
REFERENCE = {
    'roti': (80, 130), 'idli': (40, 75), 'plain-dosa': (120, 220), 'masala-dosa': (230, 420), 'toor-dal': (90, 180),
    'steamed-rice': (150, 230), 'samosa': (200, 330), 'gulab-jamun': (100, 180), 'masala-chai': (50, 110), 'chicken-curry': (180, 350),
    'poha': (250, 420), 'paneer-butter-masala': (220, 420), 'chicken-biryani': (350, 650), 'rasgulla': (80, 150), 'medu-vada': (80, 170),
    'upma': (130, 260), 'sambar': (50, 140), 'plain-paratha': (170, 300), 'curd-rice': (120, 260), 'rajma': (120, 260),
}


@pytest.mark.parametrize('slug, low, high', [(s, lo, hi) for s, (lo, hi) in REFERENCE.items()])
def test_everyday_portions_are_in_published_ranges(db, slug, low, high):
    assert low <= per_portion(db, slug) <= high, f'{slug}: {per_portion(db, slug):.0f} kcal per portion'


def test_values_are_marked_as_calculated_and_not_verified(db):
    food = dish(db, 'sambar')
    assert not food.is_verified and all(n.is_estimated and 'IFCT 2017 ingredients' in n.source_note for n in food.nutrients)
    assert food.serving_size_description == '1 katori (150 g)' and [p.label for p in sorted(food.portions, key=lambda p: p.position)][0] == '1 katori (150 g)'
    assert 'Red gram, dal' in food.ingredients


@pytest.mark.parametrize('query, slug', [('idly', 'idli'), ('sambhar', 'sambar'), ('chapathi', 'roti'), ('chicken biriyani', 'chicken-biryani'),
                                         ('chai', 'masala-chai'), ('खिचड़ी', 'khichdi'), ('thayir sadam', 'curd-rice'), ('pohe', 'poha')])
def test_search_finds_dishes_by_everyday_spellings_and_local_names(db, query, slug):
    found = search(db, query, limit=10)
    target = dish(db, slug)
    assert any(item['id'] == target.id for item in found), [item['name'] for item in found]
    assert next(item for item in found if item['id'] == target.id)['source'] == RECIPE_SOURCE


def test_ifct_energy_that_its_macronutrients_cannot_supply_is_corrected(db):
    leg = db.query(models.Food).filter_by(data_source=models.NutritionDataSource.ifct, external_id='N001').one()
    energy = next(n for n in leg.nutrients if n.nutrient_def.slug == 'energy_kcal')
    assert energy.amount_per_100g < 230 and energy.is_estimated and '384 kcal' in energy.source_note
    breast = db.query(models.Food).filter_by(data_source=models.NutritionDataSource.ifct, external_id='N003').one()
    assert not next(n for n in breast.nutrients if n.nutrient_def.slug == 'energy_kcal').is_estimated   # consistent values are left alone
