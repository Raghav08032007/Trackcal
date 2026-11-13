"""household portions for Indian (IFCT) foods: a katori of dal, a roti's worth of atta, a teaspoon of ghee...

None of the 542 IFCT foods had a serving size, so logging dal or paneer meant typing grams. Each food group gets the household
measures people use, by weight, each labelled "about": ICMR-NIN household measures (Dietary Guidelines for Indians) and USDA
FoodData Central portion weights. Only foods with no portion yet get them.

Downgrade removes exactly these portions.

Revision ID: 0024
Revises: 0023
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = '0024'
down_revision: Union[str, None] = '0023'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def portions(category, name):
    n = (name or '').lower()
    c = (category or '').lower()
    if 'cereal' in c or 'millet' in c:
        if 'flake' in n: return [('1 cup (about 45 g)', 45)]
        if 'rice' in n: return [('1 cup cooked (about 60 g raw)', 60), ('1 tablespoon raw', 15)]
        return [('1 roti (about 30 g flour)', 30), ('1 cup flour (about 120 g)', 120)]
    if 'legume' in c: return [('1 katori cooked dal (about 30 g raw)', 30), ('1 tablespoon raw', 15)]
    if 'leafy' in c: return [('1 cup chopped raw (about 30 g)', 30), ('1 katori cooked (about 100 g)', 100)]
    if 'vegetable' in c or 'tuber' in c or 'mushroom' in c: return [('1 katori cooked (about 100 g)', 100), ('1 cup chopped (about 120 g)', 120)]
    if 'fruit' in c: return [('1 medium fruit (about 100 g)', 100), ('1 cup pieces (about 150 g)', 150)]
    if 'nut' in c or 'seed' in c: return [('1 handful (about 28 g)', 28), ('1 tablespoon (about 10 g)', 10)]
    if 'oil' in c or 'fat' in c: return [('1 teaspoon (5 g)', 5), ('1 tablespoon (14 g)', 14)]
    if 'sugar' in c: return [('1 teaspoon (5 g)', 5), ('1 tablespoon (12 g)', 12)]
    if 'milk' in c:
        if 'paneer' in n or 'khoa' in n or 'cheese' in n: return [('1 cube (about 15 g)', 15), ('1 katori (about 100 g)', 100)]
        if 'curd' in n or 'yog' in n: return [('1 katori (about 100 g)', 100)]
        return [('1 glass (200 ml, about 206 g)', 206), ('1 cup (about 244 g)', 244)]
    if 'egg' in c: return [('1 egg (about 50 g)', 50)]
    if 'meat' in c or 'poultry' in c or 'fish' in c or 'shellfish' in c or 'mollus' in c: return [('1 serving (about 100 g)', 100), ('1 piece (about 50 g)', 50)]
    if 'spice' in c or 'condiment' in c: return [('1 teaspoon (about 3 g)', 3), ('1 tablespoon (about 8 g)', 8)]
    return []


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT f.id, f.category, f.name FROM foods f WHERE f.data_source = 'ifct' "
                                'AND NOT EXISTS (SELECT 1 FROM food_portions p WHERE p.food_id = f.id)')).fetchall()
    for food_id, category, name in rows:
        for position, (label, grams) in enumerate(portions(category, name)):
            bind.execute(sa.text('INSERT INTO food_portions (id, food_id, label, grams, position) VALUES (:id, :f, :l, :g, :p)'),
                         {'id': str(uuid.uuid4()), 'f': food_id, 'l': label, 'g': grams, 'p': position})


def downgrade() -> None:
    bind = op.get_bind()
    for food_id, category, name in bind.execute(sa.text("SELECT id, category, name FROM foods WHERE data_source = 'ifct'")).fetchall():
        for label, grams in portions(category, name):
            bind.execute(sa.text('DELETE FROM food_portions WHERE food_id = :f AND label = :l AND grams = :g'), {'f': food_id, 'l': label, 'g': grams})
