"""activity posts: a shared GPS activity appears in the feed as a post linked to it, for kudos and comments

Downgrade drops the link.

Revision ID: 0015
Revises: 0014
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0015'
down_revision: Union[str, None] = '0014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('posts', sa.Column('activity_id', sa.CHAR(length=36), nullable=True))
    op.create_foreign_key('fk_posts_activity', 'posts', 'activities', ['activity_id'], ['id'], ondelete='CASCADE')
    op.create_unique_constraint('uq_posts_activity', 'posts', ['activity_id'])


def downgrade() -> None:
    op.drop_constraint('fk_posts_activity', 'posts', type_='foreignkey')
    op.drop_constraint('uq_posts_activity', 'posts', type_='unique')
    op.drop_column('posts', 'activity_id')
