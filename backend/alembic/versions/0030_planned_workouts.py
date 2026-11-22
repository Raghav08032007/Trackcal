"""planned workouts: workouts a person plans for a coming day, shown in the journal until done (services/journal.py)

Downgrade drops the table.

Revision ID: 0030
Revises: 0029
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision: str = '0030'
down_revision: Union[str, None] = '0029'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'planned_workouts',
        sa.Column('id', mysql.CHAR(36), primary_key=True),
        sa.Column('user_id', mysql.CHAR(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day', sa.String(10), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('minutes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sets', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('reps', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('load_kg', sa.Float(), nullable=False, server_default='0'),
        sa.Column('notes', sa.String(300), nullable=False, server_default=''),
        sa.Column('done_entry_id', mysql.CHAR(36), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_planned_workouts_user_day', 'planned_workouts', ['user_id', 'day'])


def downgrade() -> None:
    op.drop_index('ix_planned_workouts_user_day', table_name='planned_workouts')
    op.drop_table('planned_workouts')
