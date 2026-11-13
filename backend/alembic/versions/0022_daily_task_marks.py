"""daily task marks: which of today's three tasks were done, for the streak

Downgrade drops the table.

Revision ID: 0022
Revises: 0021
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0022'
down_revision: Union[str, None] = '0021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('daily_task_marks',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('day', sa.String(length=10), nullable=False),
                    sa.Column('task', sa.String(length=16), nullable=False),
                    sa.Column('ticked', sa.Boolean(), nullable=False),
                    sa.Column('created_at', sa.DateTime(), nullable=False),
                    sa.UniqueConstraint('user_id', 'day', 'task', name='uq_daily_task_mark'))


def downgrade() -> None:
    op.drop_table('daily_task_marks')
