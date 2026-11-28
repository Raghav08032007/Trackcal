"""more food search names: everyday words for foods IFCT spells differently (omelette -> omlet, amla -> goosberry)

Found by the 188-food search test (tests/food_bench.py). Same rules as 0031: each pair maps the typed word to the
catalog's word; the typed word is searched too. Existing rows are left alone; downgrade removes only these rows.

Revision ID: 0033
Revises: 0032
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0033'
down_revision: Union[str, None] = '0032'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SYNONYMS = {
    'omelette': 'omlet', 'omelet': 'omlet', 'omlette': 'omlet', 'amlet': 'omlet',
    'panir': 'paneer', 'jackfruit': 'jack fruit', 'kathal': 'jack fruit', 'watermelon': 'water melon', 'tarbooz': 'water melon',
    'amla': 'goosberry', 'aonla': 'goosberry', 'gooseberry': 'goosberry', 'nellikai': 'goosberry',
    'chikoo': 'sapota', 'chiku': 'sapota', 'sapodilla': 'sapota',
    'green peas': 'peas', 'matar': 'peas', 'mutter': 'peas',
}


def upgrade() -> None:
    bind = op.get_bind()
    have = {row[0] for row in bind.execute(sa.text('SELECT term FROM search_synonyms'))}
    for term, canonical in SYNONYMS.items():
        if term not in have:
            bind.execute(sa.text('INSERT INTO search_synonyms (term, canonical) VALUES (:t, :c)'), {'t': term, 'c': canonical})


def downgrade() -> None:
    op.get_bind().execute(sa.text('DELETE FROM search_synonyms WHERE term IN :terms').bindparams(sa.bindparam('terms', expanding=True)),
                          {'terms': list(SYNONYMS)})
