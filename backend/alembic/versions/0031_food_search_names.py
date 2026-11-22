"""food search names: everyday words that reach the catalog's own name (peanut -> ground nut)

IFCT names some foods differently from how people type them. Each pair maps the typed word to the catalog's word; the
search still looks for the typed word too, so USDA foods named "Peanuts, ..." are found as before.
Existing rows are left alone; downgrade removes only the rows this revision added.

Revision ID: 0031
Revises: 0030
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0031'
down_revision: Union[str, None] = '0030'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SYNONYMS = {
    'peanut': 'ground nut', 'peanuts': 'ground nut', 'groundnut': 'ground nut', 'groundnuts': 'ground nut',
    'moongphali': 'ground nut', 'mungfali': 'ground nut', 'shengdana': 'ground nut', 'verkadalai': 'ground nut',
    'kaju': 'cashew', 'badam': 'almond', 'akhrot': 'walnut', 'kishmish': 'raisin',
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
