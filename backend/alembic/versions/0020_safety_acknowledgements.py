"""safety acknowledgements: the person chose to do an exercise the app advised against, after being told why

Downgrade drops the table.

Revision ID: 0020
Revises: 0019
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0020'
down_revision: Union[str, None] = '0019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('safety_acknowledgements',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('template', sa.String(length=40), nullable=False),
                    sa.Column('level', sa.String(length=10), nullable=False),
                    sa.Column('reasons', sa.JSON(), nullable=False),
                    sa.Column('created_at', sa.DateTime(), nullable=False))


def downgrade() -> None:
    op.drop_table('safety_acknowledgements')
