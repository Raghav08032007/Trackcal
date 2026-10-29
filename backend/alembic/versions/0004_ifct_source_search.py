"""IFCT data source, search synonyms and a full-text index on food names

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-29

Downgrade note: the 'ifct' enum value is removed, so IFCT catalog foods (re-creatable with
scripts/seed_ifct.py) are deleted. Meals, recipes and AI predictions that referenced them are detached
(they keep their own name and nutrient copy) and relabelled 'community'. No user record is deleted.
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

OLD = ('usda', 'open_food_facts', 'user_created', 'community', 'ocr_extracted', 'ai_estimated', 'restaurant_official')
NEW = OLD + ('ifct',)
SYNONYMS = [  # spelling variant -> canonical search term
    ('idly', 'idli'), ('idlee', 'idli'), ('dosai', 'dosa'), ('dosay', 'dosa'), ('thosai', 'dosa'), ('sambhar', 'sambar'),
    ('chapathi', 'chapati'), ('chappati', 'chapati'), ('roti', 'chapati'), ('phulka', 'chapati'), ('dhal', 'dal'), ('daal', 'dal'),
    ('dahl', 'dal'), ('thayir', 'curd'), ('dahi', 'curd'), ('yogurt', 'curd'), ('yoghurt', 'curd'), ('chawal', 'rice'),
    ('biriyani', 'biryani'), ('briyani', 'biryani'), ('paratha', 'parotta'), ('aloo', 'potato'), ('alu', 'potato'), ('brinjal', 'eggplant'),
    ('baingan', 'eggplant'), ('bhindi', 'okra'), ("lady's finger", 'okra'), ('ladies finger', 'okra'), ('ragi', 'finger millet'),
    ('paneer', 'paneer'), ('channa', 'chickpea'), ('chana', 'chickpea'), ('rajma', 'kidney bean'),
]


def upgrade() -> None:
    for table in ('foods', 'meal_items'):
        op.alter_column(table, 'data_source', existing_type=sa.Enum(*OLD, name='nutritiondatasource'),
                        type_=sa.Enum(*NEW, name='nutritiondatasource'), existing_nullable=True)
    synonyms = op.create_table('search_synonyms', sa.Column('term', sa.String(length=60), nullable=False),
                               sa.Column('canonical', sa.String(length=60), nullable=False), sa.PrimaryKeyConstraint('term'))
    op.bulk_insert(synonyms, [{'term': term, 'canonical': canonical} for term, canonical in SYNONYMS if term != canonical])
    op.create_index('ft_foods_name', 'foods', ['name'], unique=False, mysql_prefix='FULLTEXT')


def downgrade() -> None:
    op.drop_index('ft_foods_name', table_name='foods')
    op.drop_table('search_synonyms')
    # Detach references first (RESTRICT foreign keys); meal items keep their own name and nutrient copy.
    ifct = "SELECT id FROM (SELECT id FROM foods WHERE data_source = 'ifct') AS ifct_ids"
    for table, column in (('meal_items', 'food_id'), ('recipe_ingredients', 'food_id'), ('ai_predictions', 'food_id'), ('ai_predictions', 'corrected_food_id')):
        op.execute(f"UPDATE {table} SET {column} = NULL WHERE {column} IN ({ifct})")
    op.execute("UPDATE meal_items SET data_source = 'community' WHERE data_source = 'ifct'")
    op.execute("DELETE FROM foods WHERE data_source = 'ifct'")
    for table in ('foods', 'meal_items'):
        op.alter_column(table, 'data_source', existing_type=sa.Enum(*NEW, name='nutritiondatasource'),
                        type_=sa.Enum(*OLD, name='nutritiondatasource'), existing_nullable=True)
