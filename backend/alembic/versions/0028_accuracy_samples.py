"""accuracy samples: an AI estimate next to the value the person kept, for the accuracy report (services/accuracy.py)

Downgrade drops the table.

Revision ID: 0028
Revises: 0027
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision: str = '0028'
down_revision: Union[str, None] = '0027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'accuracy_samples',
        sa.Column('id', mysql.CHAR(36), primary_key=True),
        sa.Column('user_id', mysql.CHAR(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('source_id', mysql.CHAR(36), nullable=False),
        sa.Column('estimate', sa.Float(), nullable=False),
        sa.Column('final', sa.Float(), nullable=False),
        sa.Column('estimate_aux', sa.Float(), nullable=True),
        sa.Column('final_aux', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('kind', 'source_id', name='uq_accuracy_kind_source'),
    )
    op.create_index('ix_accuracy_samples_user_id', 'accuracy_samples', ['user_id'])
    op.create_index('ix_accuracy_samples_kind_created', 'accuracy_samples', ['kind', 'created_at'])


def downgrade() -> None:
    op.drop_table('accuracy_samples')
