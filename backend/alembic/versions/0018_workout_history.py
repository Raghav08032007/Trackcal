"""workout history: hand-logged workouts, and circuits, program progress and next targets on the account

Downgrade drops both tables.

Revision ID: 0018
Revises: 0017
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0018'
down_revision: Union[str, None] = '0017'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('workout_entries',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
                    sa.Column('day', sa.String(length=10), nullable=False),
                    sa.Column('name', sa.String(length=120), nullable=False),
                    sa.Column('minutes', sa.Integer(), nullable=False, server_default='0'),
                    sa.Column('sets', sa.Integer(), nullable=False, server_default='0'),
                    sa.Column('reps', sa.Integer(), nullable=False, server_default='0'),
                    sa.Column('load_kg', sa.Float(), nullable=False, server_default='0'),
                    sa.Column('source', sa.String(length=40), nullable=False, server_default='Manual entry'),
                    sa.Column('created_at', sa.DateTime(), nullable=False),
                    sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index('ix_workout_entries_user_day', 'workout_entries', ['user_id', 'day'])
    op.create_table('training_libraries',
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
                    sa.Column('circuits', sa.JSON(), nullable=False),
                    sa.Column('program_days', sa.JSON(), nullable=False),
                    sa.Column('next_targets', sa.JSON(), nullable=False),
                    sa.Column('updated_at', sa.DateTime(), nullable=False))


def downgrade() -> None:
    op.drop_table('training_libraries')
    op.drop_index('ix_workout_entries_user_day', table_name='workout_entries')
    op.drop_table('workout_entries')
