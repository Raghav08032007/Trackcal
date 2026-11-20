"""coach clients: a client shares chosen progress (food totals, workouts, weight) with a coach (routers/coach_clients.py)

Downgrade drops the table.

Revision ID: 0029
Revises: 0028
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision: str = '0029'
down_revision: Union[str, None] = '0028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'coach_clients',
        sa.Column('id', mysql.CHAR(36), primary_key=True),
        sa.Column('coach_id', mysql.CHAR(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id', mysql.CHAR(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('status', sa.String(10), nullable=False),
        sa.Column('invite_hash', sa.String(64), nullable=True),
        sa.Column('invite_expires_at', sa.DateTime(), nullable=True),
        sa.Column('share', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('invite_hash', name='uq_coach_clients_invite'),
    )
    op.create_index('ix_coach_clients_coach', 'coach_clients', ['coach_id', 'status'])
    op.create_index('ix_coach_clients_client', 'coach_clients', ['client_id', 'status'])


def downgrade() -> None:
    op.drop_table('coach_clients')
