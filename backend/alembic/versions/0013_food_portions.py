"""food portions: real serving sizes in grams ("1 cup, chopped" = 150 g) and ingredient lists for mixed dishes

Downgrade drops both.

Revision ID: 0013
Revises: 0012
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0013'
down_revision: Union[str, None] = '0012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('food_portions',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('food_id', sa.CHAR(length=36), sa.ForeignKey('foods.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('label', sa.String(length=120), nullable=False),
                    sa.Column('grams', sa.Float(), nullable=False),
                    sa.Column('position', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('foods', sa.Column('ingredients', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('foods', 'ingredients')
    op.drop_table('food_portions')
