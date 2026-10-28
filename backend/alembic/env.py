"""Alembic environment. Uses the application's own engine settings and ORM metadata.

Target another schema on the same server with:  alembic -x db=<schema> upgrade head
"""
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from database import Base, engine  # noqa: E402
import models  # noqa: E402,F401  registers every table on Base.metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
schema = context.get_x_argument(as_dictionary=True).get("db")
url = engine.url.set(database=schema) if schema else engine.url


def run_migrations_offline():
    context.configure(url=url.render_as_string(hide_password=False), target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = create_engine(url, pool_pre_ping=True)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
