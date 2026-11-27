"""micronutrients: zinc and magnesium join the nutrient definitions

The food importers (scripts/seed_ifct.py, scripts/import_usda.py) now bring in vitamins and minerals for the daily
micronutrient view. Iron, calcium, potassium, sodium, vitamin C, vitamin D, B12 and folate are already defined; zinc and
magnesium are added here. Existing rows are left alone; downgrade removes only rows this revision added (and their values).

Revision ID: 0032
Revises: 0031
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = '0032'
down_revision: Union[str, None] = '0031'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW = [('zinc', 'Zinc', 'mg', 'mineral', 13), ('magnesium', 'Magnesium', 'mg', 'mineral', 14)]


def upgrade() -> None:
    bind = op.get_bind()
    have = {row[0] for row in bind.execute(sa.text('SELECT slug FROM nutrient_definitions'))}
    for slug, name, unit, category, order in NEW:
        if slug not in have:
            bind.execute(sa.text('INSERT INTO nutrient_definitions (id, name, slug, unit, category, display_order) '
                                 'VALUES (:id, :name, :slug, :unit, :category, :ord)'),
                         {'id': str(uuid.uuid4()), 'name': name, 'slug': slug, 'unit': unit, 'category': category, 'ord': order})


def downgrade() -> None:
    bind = op.get_bind()
    for slug, *_ in NEW:
        bind.execute(sa.text('DELETE FROM food_nutrients WHERE nutrient_def_id IN (SELECT id FROM nutrient_definitions WHERE slug = :s)'), {'s': slug})
        bind.execute(sa.text('DELETE FROM nutrient_definitions WHERE slug = :s'), {'s': slug})
