"""lab reports: confirmed blood test values (the uploaded file itself is never stored)

Downgrade drops both tables.

Revision ID: 0016
Revises: 0015
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0016'
down_revision: Union[str, None] = '0015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('lab_reports',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('report_date', sa.String(length=10), nullable=False),
                    sa.Column('lab_name', sa.String(length=80), nullable=True),
                    sa.Column('source', sa.String(length=12), nullable=False),
                    sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_table('lab_results',
                    sa.Column('id', sa.CHAR(length=36), primary_key=True),
                    sa.Column('report_id', sa.CHAR(length=36), sa.ForeignKey('lab_reports.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('user_id', sa.CHAR(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
                    sa.Column('code', sa.String(length=24), nullable=False),
                    sa.Column('value', sa.Float(), nullable=False),
                    sa.Column('ref_low', sa.Float(), nullable=True),
                    sa.Column('ref_high', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_table('lab_results')
    op.drop_table('lab_reports')
