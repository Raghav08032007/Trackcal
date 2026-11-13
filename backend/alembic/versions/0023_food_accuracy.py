"""food accuracy: per-serving seed values corrected to per 100 g, one IFCT energy error fixed, everyday Indian names added

- 21 seed foods were stored with the values for one serving. Each is scaled to 100 g, only while it still holds the original
  per-serving energy, so running this twice changes nothing.
- IFCT "Chicken, poultry, leg, skinless" listed 384 kcal while its own protein, carbohydrate and fat add up to about half that;
  its energy is set from those (4/4/9 kcal per gram).
- Everyday names (toor dal, poha, dahi, palak, aloo, kela...) become aliases of the basic food they mean.

Downgrade restores the per-serving values and the IFCT energy, and removes the added aliases.

Revision ID: 0023
Revises: 0022
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = '0023'
down_revision: Union[str, None] = '0022'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# name: (serving in grams, the per-serving energy it was stored with)
PER_SERVING = {
    'Miso Soup': (240, 40), 'Tonkotsu Ramen (bowl)': (500, 460), 'Bibimbap (bowl)': (400, 490), 'Japchae': (200, 270), 'Fried Rice': (200, 350),
    'Sweet and Sour Pork': (150, 295), 'Chicken Taco (1 piece)': (130, 285), 'Guacamole (2 tbsp)': (30, 48), 'Black Bean Burrito': (280, 450),
    'Hummus (2 tbsp)': (30, 70), 'Greek Salad': (200, 160), 'Caesar Salad': (200, 295), 'Blueberry Smoothie': (350, 175),
    'Oatmeal with Berries': (250, 200), 'Pad Thai (plate)': (300, 490), 'Nasi Goreng (plate)': (350, 525), 'Pho Bo (bowl)': (500, 355),
    'Jollof Rice (serving)': (200, 320), 'Ceviche (serving)': (150, 115), 'Whole Milk (cup)': (244, 149), 'Brown Bread (slice)': (28, 69),
}
CHICKEN_LEG = ('Chicken, poultry, leg, skinless', 384.0)
ALIASES = {
    'Red gram, dal': ['toor dal', 'tuvar dal', 'arhar dal', 'toor', 'tuvar'],
    'Rice flakes': ['poha', 'aval', 'avalakki', 'chivda rice'],
    'Yogurt, plain, whole milk': ['dahi', 'curd', 'thayir', 'doi'],
    'Spinach, raw': ['palak'],
    'Potatoes, flesh and skin, raw': ['aloo', 'alu', 'batata'],
    'Bananas, raw': ['kela', 'kele'],
    'Okra, raw': ['bhindi', 'vendakkai'],
    'Onions, raw': ['pyaz', 'pyaaz', 'kanda'],
    'Fenugreek leaves': ['methi', 'methi leaves'],
    'Eggplant, raw': ['baingan', 'brinjal', 'vangi'],
    'Carrots, raw': ['gajar'],
    'Tomatoes, red, ripe, raw, year round average': ['tamatar'],
    'Egg, whole, raw, fresh': ['anda', 'egg'],
    'Egg, white, raw, fresh': ['egg white'],
    'Milk, whole': ['doodh', 'milk'],
    'Coconut, kernel, fresh': ['nariyal', 'thengai', 'coconut'],
    'Rice, raw, milled': ['basmati', 'basmati rice'],
}


def _energy_id(bind):
    return bind.execute(sa.text("SELECT id FROM nutrient_definitions WHERE slug = 'energy_kcal'")).scalar()


def _scale(bind, food_id, factor):
    bind.execute(sa.text('UPDATE food_nutrients SET amount_per_100g = ROUND(amount_per_100g * :f, 3) WHERE food_id = :id'), {'f': factor, 'id': food_id})


def upgrade() -> None:
    bind = op.get_bind(); energy = _energy_id(bind)
    if energy is None:
        return  # an empty catalog: nothing to correct
    for name, (grams, kcal) in PER_SERVING.items():
        for (food_id,) in bind.execute(sa.text('SELECT f.id FROM foods f JOIN food_nutrients n ON n.food_id = f.id AND n.nutrient_def_id = :e '
                                               'WHERE f.name = :name AND ABS(n.amount_per_100g - :kcal) < 0.01'), {'e': energy, 'name': name, 'kcal': kcal}):
            _scale(bind, food_id, 100 / grams)
    name, wrong = CHICKEN_LEG
    for (food_id,) in bind.execute(sa.text('SELECT f.id FROM foods f JOIN food_nutrients n ON n.food_id = f.id AND n.nutrient_def_id = :e '
                                           'WHERE f.name = :name AND ABS(n.amount_per_100g - :kcal) < 0.01'), {'e': energy, 'name': name, 'kcal': wrong}):
        macros = dict(bind.execute(sa.text('SELECT d.slug, n.amount_per_100g FROM food_nutrients n JOIN nutrient_definitions d ON d.id = n.nutrient_def_id '
                                           "WHERE n.food_id = :id AND d.slug IN ('protein', 'carbohydrates', 'fat')"), {'id': food_id}).fetchall())
        fixed = round(4 * (macros.get('protein') or 0) + 4 * (macros.get('carbohydrates') or 0) + 9 * (macros.get('fat') or 0), 1)
        bind.execute(sa.text('UPDATE food_nutrients SET amount_per_100g = :v WHERE food_id = :id AND nutrient_def_id = :e'), {'v': fixed, 'id': food_id, 'e': energy})
    for name, aliases in ALIASES.items():
        food_id = bind.execute(sa.text('SELECT id FROM foods WHERE name = :name ORDER BY id LIMIT 1'), {'name': name}).scalar()
        if not food_id:
            continue
        for alias in aliases:
            if not bind.execute(sa.text('SELECT 1 FROM food_aliases WHERE food_id = :f AND alias = :a'), {'f': food_id, 'a': alias}).first():
                bind.execute(sa.text('INSERT INTO food_aliases (id, food_id, alias) VALUES (:id, :f, :a)'), {'id': str(uuid.uuid4()), 'f': food_id, 'a': alias})


def downgrade() -> None:
    bind = op.get_bind(); energy = _energy_id(bind)
    if energy is None:
        return
    for name, (grams, kcal) in PER_SERVING.items():
        for (food_id,) in bind.execute(sa.text('SELECT f.id FROM foods f JOIN food_nutrients n ON n.food_id = f.id AND n.nutrient_def_id = :e '
                                               'WHERE f.name = :name AND ABS(n.amount_per_100g - :kcal) < 0.05'), {'e': energy, 'name': name, 'kcal': kcal * 100 / grams}):
            _scale(bind, food_id, grams / 100)
    name, wrong = CHICKEN_LEG
    bind.execute(sa.text('UPDATE food_nutrients n JOIN foods f ON f.id = n.food_id SET n.amount_per_100g = :v WHERE f.name = :name AND n.nutrient_def_id = :e'),
                 {'v': wrong, 'name': name, 'e': energy})
    for name, aliases in ALIASES.items():
        food_id = bind.execute(sa.text('SELECT id FROM foods WHERE name = :name ORDER BY id LIMIT 1'), {'name': name}).scalar()
        if food_id:
            for alias in aliases:
                bind.execute(sa.text('DELETE FROM food_aliases WHERE food_id = :f AND alias = :a'), {'f': food_id, 'a': alias})
