"""Food accuracy on the real catalog: what an everyday word finds, and whether its calories and first portion are right.

Each row: what people type, the food it must find (a pattern on the name), and the published range for that food per 100 g
(IFCT 2017 / USDA FoodData Central values, widened for regional and recipe variation), plus the range for the first
portion offered, in grams. Runs only where the IFCT catalog is loaded (scripts/seed_ifct.py, seed_standard_recipes.py).
`pytest tests/test_food_accuracy.py -s` prints the score per food group.
"""
import re

import pytest

import database
import models
from services.food_search import search

BENCH = [  # group, typed, name pattern, kcal per 100 g, first portion grams (or None)
    ('grains', 'rice', r'rice, cooked', (100, 160), (100, 300)),
    ('grains', 'boiled rice', r'rice, cooked', (100, 160), (100, 300)),
    ('grains', 'roti', r'roti / chapati', (220, 320), (30, 60)),
    ('grains', 'chapati', r'chapati', (220, 320), (30, 60)),
    ('grains', 'paratha', r'paratha', (250, 340), (40, 120)),
    ('grains', 'idli', r'^idli', (110, 170), None),
    ('grains', 'dosa', r'dosa', (150, 240), None),
    ('grains', 'poha', r'^poha', (130, 220), None),
    ('grains', 'upma', r'^upma', (90, 200), None),
    ('dishes', 'dal', r'^dal', (60, 140), (100, 250)),
    ('dishes', 'rajma', r'^rajma \(', (80, 160), (100, 250)),
    ('dishes', 'chole', r'^chole', (80, 170), (100, 250)),
    ('dishes', 'sambar', r'^sambar', (30, 90), None),
    ('dishes', 'khichdi', r'^khichdi', (70, 150), None),
    ('dishes', 'biryani', r'biryani', (130, 220), (150, 350)),
    ('dishes', 'chicken curry', r'^chicken curry', (110, 220), None),
    ('dishes', 'aloo sabzi', r'^aloo sabzi', (70, 150), None),
    ('protein', 'egg', r'^egg, (poultry, )?whole', (130, 175), None),
    ('protein', 'boiled egg', r'^egg, (poultry, )?whole.*boiled', (130, 175), None),
    ('protein', 'paneer', r'^paneer', (240, 330), None),
    ('protein', 'peanuts', r'ground ?nut|peanut', (520, 600), None),
    ('protein', 'almonds', r'^almond', (570, 630), None),
    ('dairy', 'milk', r'^milk, whole', (55, 110), None),
    ('dairy', 'curd', r'^curd \(|yogurt', (55, 110), (80, 200)),
    ('dairy', 'ghee', r'^ghee', (880, 905), None),
    ('dairy', 'tea', r'tea|chai', (30, 90), (100, 250)),
    ('dairy', 'lassi', r'lassi', (60, 130), (150, 300)),
    ('fruit', 'banana', r'^banana', (80, 130), None),
    ('fruit', 'apple', r'^apple', (45, 70), None),
    ('fruit', 'mango', r'^mango, ripe', (40, 80), None),
    ('fruit', 'orange', r'^orange', (30, 55), None),
    ('veg', 'potato', r'^potato', (55, 100), None),
    ('sweet', 'sugar', r'^sugar', (380, 400), (3, 6)),
    ('sweet', 'jaggery', r'^jaggery', (340, 400), None),
]


@pytest.fixture(scope='module')
def db():
    with database.SessionLocal() as session:
        if session.query(models.Food).filter(models.Food.data_source == models.NutritionDataSource.ifct).count() < 300:
            pytest.skip('The IFCT catalog is not loaded here.')
        yield session


def check(db, typed, pattern, kcal, portion):
    rows = search(db, typed, limit=1)
    if not rows: return 'not found', None
    top = rows[0]
    if not re.search(pattern, top['name'].lower()): return 'wrong food', top
    if not kcal[0] <= top['calories'] <= kcal[1]: return 'calories off', top
    if portion and not (top['portions'] and portion[0] <= top['portions'][0]['grams'] <= portion[1]): return 'portion off', top
    return 'ok', top


def test_everyday_foods_are_found_with_the_right_calories_and_portions(db):
    groups, misses = {}, []
    for group, typed, pattern, kcal, portion in BENCH:
        verdict, top = check(db, typed, pattern, kcal, portion)
        groups.setdefault(group, []).append(verdict == 'ok')
        if verdict != 'ok': misses.append(f"{typed}: {verdict} ({top['name']} {top['calories']} kcal)" if top else f'{typed}: {verdict}')
    for group, oks in groups.items(): print(f'{group:8} {round(100 * sum(oks) / len(oks)):3d}/100  ({sum(oks)}/{len(oks)})')
    assert not misses, misses
