"""workspace sync: app settings and lists saved per key with a version, so devices merge instead of overwriting

Downgrade drops the table.

Revision ID: 0019
Revises: 0018
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0019'
down_revision: Union[str, None] = '0018'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('workspace_entries',
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
                    sa.Column('key', sa.String(length=80), primary_key=True),
                    sa.Column('value', sa.JSON(), nullable=True),
                    sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
                    sa.Column('updated_at', sa.DateTime(), nullable=False))


def downgrade() -> None:
    op.drop_table('workspace_entries')
