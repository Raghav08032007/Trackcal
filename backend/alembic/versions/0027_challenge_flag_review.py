"""challenge flag review: when a moderator reviewed a flagged challenge entry, so the flag is not raised again (KI-49)

Downgrade drops the column.

Revision ID: 0027
Revises: 0026
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0027'
down_revision: Union[str, None] = '0026'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('challenge_participants', sa.Column('flag_reviewed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('challenge_participants', 'flag_reviewed_at')
