# Historical SQL migrations (frozen)

These additive SQL files built the schema up to Phase 1. They are kept for history only. **Alembic is the migration authority from revision `0001` onward** (`backend/alembic/versions`); revision `0001` reproduces exactly the schema these files produced (proved by `scripts/dry_run_migrations.py`, 28 October 2026).

- New schema changes: `alembic revision --autogenerate -m "..."`, review the file, write a working `downgrade()`, then run `python scripts/dry_run_migrations.py` before applying.
- Release: `python scripts/bootstrap_schema.py` (stamps a pre-Alembic database at `0001`, then `alembic upgrade head`).
- Do not add files here.
