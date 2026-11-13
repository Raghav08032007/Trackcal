"""pain check-ins: daily pain for an injured or operated part, which moves its recovery stage

Downgrade drops the table.

Revision ID: 0021
Revises: 0020
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0021'
down_revision: Union[str, None] = '0020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('pain_checkins',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('part', sa.String(length=24), nullable=False),
                    sa.Column('day', sa.String(length=10), nullable=False),
                    sa.Column('pain', sa.Integer(), nullable=False),
                    sa.Column('trend', sa.String(length=8), nullable=False),
                    sa.Column('red_flags', sa.JSON(), nullable=False),
                    sa.Column('created_at', sa.DateTime(), nullable=False),
                    sa.UniqueConstraint('user_id', 'part', 'day', name='uq_pain_checkin_day'))


def downgrade() -> None:
    op.drop_table('pain_checkins')
