"""daily wellness: water, movement, calories burned, sleep and mood, one row per person per day

Downgrade drops the table.

Revision ID: 0017
Revises: 0016
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0017'
down_revision: Union[str, None] = '0016'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('daily_wellness',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
                    sa.Column('day', sa.String(length=10), nullable=False),
                    sa.Column('water_ml', sa.Integer(), nullable=False, server_default='0'),
                    sa.Column('water_goal_ml', sa.Integer(), nullable=True),
                    sa.Column('steps', sa.Integer(), nullable=False, server_default='0'),
                    sa.Column('active_minutes', sa.Integer(), nullable=False, server_default='0'),
                    sa.Column('activity', sa.String(length=100), nullable=False, server_default=''),
                    sa.Column('burn_kcal', sa.Float(), nullable=False, server_default='0'),
                    sa.Column('weight_kg', sa.Float(), nullable=True),
                    sa.Column('sleep_hours', sa.Float(), nullable=True),
                    sa.Column('sleep_quality', sa.String(length=8), nullable=True),
                    sa.Column('energy', sa.String(length=8), nullable=True),
                    sa.Column('sore', sa.String(length=8), nullable=True),
                    sa.Column('updated_at', sa.DateTime(), nullable=False),
                    sa.UniqueConstraint('user_id', 'day', name='uq_daily_wellness_user_day'))


def downgrade() -> None:
    op.drop_table('daily_wellness')
