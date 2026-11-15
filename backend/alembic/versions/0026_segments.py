"""segments: named stretches of road or path, the timed passes along them, and the opt-in to the friends ranking

Downgrade drops all three.

Revision ID: 0026
Revises: 0025
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0026'
down_revision: Union[str, None] = '0025'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('segments',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('creator_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('name', sa.String(length=60), nullable=False),
                    sa.Column('kind', sa.String(length=6), nullable=False),
                    sa.Column('visibility', sa.String(length=8), nullable=False, server_default='public'),
                    sa.Column('points', sa.JSON(), nullable=False),
                    sa.Column('distance_m', sa.Float(), nullable=False),
                    sa.Column('min_lat', sa.Float(), nullable=False),
                    sa.Column('max_lat', sa.Float(), nullable=False),
                    sa.Column('min_lon', sa.Float(), nullable=False),
                    sa.Column('max_lon', sa.Float(), nullable=False),
                    sa.Column('created_at', sa.DateTime(), nullable=False),
                    sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index('ix_segment_box', 'segments', ['min_lat', 'max_lat', 'min_lon', 'max_lon'])
    op.create_table('segment_efforts',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('segment_id', sa.CHAR(length=36), sa.ForeignKey('segments.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('activity_id', sa.CHAR(length=36), sa.ForeignKey('activities.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('elapsed_s', sa.Float(), nullable=False),
                    sa.Column('started_at', sa.DateTime(), nullable=False),
                    sa.UniqueConstraint('activity_id', 'segment_id', 'started_at', name='uq_effort_pass'))
    op.create_index('ix_effort_segment_user', 'segment_efforts', ['segment_id', 'user_id'])
    op.create_table('segment_settings',
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
                    sa.Column('ranking', sa.Boolean(), nullable=False, server_default=sa.false()),
                    sa.Column('updated_at', sa.DateTime(), nullable=False))


def downgrade() -> None:
    op.drop_table('segment_settings')
    op.drop_index('ix_effort_segment_user', table_name='segment_efforts')
    op.drop_table('segment_efforts')
    op.drop_index('ix_segment_box', table_name='segments')
    op.drop_table('segments')
