"""activities: GPS walks, runs, hikes and rides with their route and server-computed stats; privacy zones cut out of shared routes

Downgrade drops both.

Revision ID: 0014
Revises: 0013
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0014'
down_revision: Union[str, None] = '0013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('activities',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('session_id', sa.CHAR(length=36), sa.ForeignKey('workout_sessions.id', ondelete='SET NULL'), nullable=True, unique=True),
                    sa.Column('sport', sa.String(length=12), nullable=False),
                    sa.Column('name', sa.String(length=120), nullable=False),
                    sa.Column('notes', sa.Text(), nullable=True),
                    sa.Column('visibility', sa.String(length=12), nullable=False, server_default='private'),
                    sa.Column('started_at', sa.DateTime(), nullable=False),
                    sa.Column('distance_m', sa.Float(), nullable=False, server_default='0'),
                    sa.Column('moving_s', sa.Float(), nullable=False, server_default='0'),
                    sa.Column('elapsed_s', sa.Float(), nullable=False, server_default='0'),
                    sa.Column('elevation_gain_m', sa.Float(), nullable=False, server_default='0'),
                    sa.Column('stats', sa.JSON(), nullable=False),
                    sa.Column('route', sa.JSON(), nullable=False),
                    sa.Column('created_at', sa.DateTime(), nullable=False),
                    sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index('ix_activity_owner_started', 'activities', ['user_id', 'started_at'])
    op.create_table('privacy_zones',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('label', sa.String(length=40), nullable=False),
                    sa.Column('lat', sa.Float(), nullable=False),
                    sa.Column('lon', sa.Float(), nullable=False),
                    sa.Column('radius_m', sa.Integer(), nullable=False, server_default='300'),
                    sa.Column('created_at', sa.DateTime(), nullable=False))


def downgrade() -> None:
    op.drop_table('privacy_zones')
    op.drop_index('ix_activity_owner_started', table_name='activities')
    op.drop_table('activities')
