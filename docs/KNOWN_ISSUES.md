# TrackCal known issues — Phase 1, 28 October 2026

Severity, per the Phase 1 rules: **Sev-1** data loss, security or privacy; **Sev-2** feature broken or missing; **Sev-3** polish. Phase 1 fixes only Sev-1 items and Sev-2 items that block later phases. Everything else is recorded here with a target phase. The long-standing launch gates in `LIMITATIONS_REGISTER.md` still apply; this file holds the issues found or confirmed by the Phase 1 audit.

## Open issues

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-00 | 1 | **No off-machine copy of the source.** Until today only 27 files were committed; `frontend/web` is a nested repo with no remote | `git ls-files`, `git remote -v` | **Mitigated:** all work is committed locally (`ee92db33`, web `135a6ff`). Pushing to a private remote is the owner's call |
| KI-01 | 2 | Concurrent XP awards can fail with a MySQL deadlock (1213) and return a 500. Integrity holds: the victim is rolled back and XP is never double-granted | `test_phase1_integrity.py::test_two_concurrent_requests_for_the_same_event_grant_xp_once`: 3 deadlocks in 30 runs while other test transactions held gap locks; 0 in 52 runs alone | Fix in the Flask port: retry the award transaction on 1213 (bounded, idempotent), or use READ COMMITTED for award transactions |
| KI-02 | 2 | Account "deletion" only deactivates. `DELETE /users/account` sets `deleted_at` and `is_active=false` and replies `account_scheduled_for_deletion`, but no job ever deletes. App stores and the DPDP Act require real erasure | `routers/users.py:167-181`; no purge job in `scripts/` | Build after the Flask port: purge job, cascade 37 tables, anonymize the 3 `SET NULL` tables (`audit_logs`, `community_submissions`, `support_tickets`), and honest response copy |
| KI-03 | 2 | Account export omits 11 user-owned tables: `saved_meals`, `user_allergens`, `consent_records`, `ai_scan_jobs`, `food_images` (metadata), `food_corrections`, `community_submissions`, `support_tickets`, `coach_bookings`, `subscriptions`, `user_devices` | `routers/users.py:185` compared with `Base.metadata` (TEST_REPORT_P1.md §8) | Add to the export during the Flask port. Justified exclusions: `account_action_tokens` (secret digests), `auth_identities` (token hashes; export the provider name only), `audit_logs` (security record, available on request), `coach_slots` (owned by the coach) |
| KI-04 | 2 | Login is rate-limited only per email address, and only when `APP_ENV=production`. There is no per-IP limit, so one password tried across many accounts is not throttled | `routers/auth.py:127-130, 185` | Add per-IP and global login buckets during the Flask port |
| KI-05 | ~~2~~ **Resolved** | Migrations cannot be reversed: plain additive SQL with no down scripts. Master Rule 2 requires reversible migrations for every later phase | `backend/migrations/*.sql`; dry run in TEST_REPORT_P1.md §9 | **Blocks later phases.** First task of the Flask port: adopt Flask-Migrate (Alembic), using the current 57-table schema as the baseline revision |
| KI-06 | ~~2~~ **Resolved** | No per-module feature-flag system. Master Rule 8 requires every new module behind a flag that defaults to off in production. Only two AI environment flags and per-rule `gamification_rules.enabled` exist | INVENTORY.md "Feature flags" | **Blocks later phases.** Add a small server-side flag table and client hook during the Flask port, before any new module |
| KI-07 | 2 | Production AI uses free OpenRouter models, which may log or train on meal photos and descriptions | `OPENROUTER_MODEL=openrouter/free` in README local mode; `app/api/analyze/route.ts` | Owner decision before public launch: a paid no-retention model, or a consent notice that names the provider's terms |
| KI-08 | 3 | `/api/analyze` is unauthenticated and unlimited outside production, and in production when `ENABLE_LOCAL_AI=true` | `app/api/analyze/route.ts:8` | Move behind the backend's authenticated quota in the Flask port. Never set `ENABLE_LOCAL_AI` on a public host |
| KI-09 | ~~3~~ **Resolved** | Migration file order: `20261028_gamification_foundation.sql` sorts after the files that depend on it. Harmless today because `bootstrap_schema.py` runs `create_all` first | Dry run | Superseded by Alembic (KI-05) |
| KI-10 | 3 | 3 accepted lint warnings: `camera-workout.tsx:22` (ref is a request counter, not a DOM node), `journey-companion.tsx:29` (guarded one-shot effect), `nutrition-dashboard.tsx:24` `<img>` (local `blob:` photos) | `npx eslint .` | Re-check after the Vite migration; the `<img>` warning is Next-specific |
| KI-11 | 3 | About 1,800 deprecation warnings per backend run, now almost all `datetime.utcnow` (the Starlette TestClient warnings left with FastAPI) | pytest output | Clears with the Flask port; replace `utcnow` with timezone-aware times |
| KI-12 | 3 | `POST /scan/adjust-cooking-style` is public. It is pure arithmetic with no database or provider call | `routers/ai_scan.py:348` | Acceptable; keep public or add a light rate limit |

## Resolved during the backend migration (28 October 2026)

| ID | Resolution | Evidence |
|---|---|---|
| KI-05 | Alembic baseline `0001` (exact Phase 1 schema) and `0002`; release job stamps pre-Alembic databases and upgrades | `scripts/dry_run_migrations.py`: upgrade, downgrade and re-upgrade on scratch and a data copy, 0 rows lost, no drift |
| KI-06 | `services/feature_flags.py`, `feature_flags` table, operator CLI; all flags off by default | `tests/test_feature_flags.py` (4) |
| KI-09 | Superseded by Alembic; old SQL files frozen (`backend/migrations/README.md`) | — |
| KI-F5 | Phase 1 privacy test race (positive control missed fast requests, about 50% of runs) | 14 consecutive 16/16 runs |

KI-01 to KI-04 remain open; they are the next backend task (TEST_REPORT_MIGRATION_BACKEND.md).

## Fixed in Phase 1

| ID | Fix | Verification |
|---|---|---|
| KI-F1 | Removed 2 unused imports (`nutrition-dashboard.tsx`, `tests/wellness.test.tsx`). Lint: 0 errors, 5 → 3 warnings | `npx eslint .`, full web suite |
| KI-F2 | Added missing proofs: database-level duplicate rejection, real two-connection concurrency, and tampering through extra fields and the query string | `tests/test_phase1_integrity.py` (4 tests) |
| KI-F3 | Added a real-browser privacy check with positive and negative controls | `frontend/web/tests/e2e-privacy.mjs` (16 checks) |
| KI-F4 | Added a reproducible migration dry run | `backend/scripts/dry_run_migrations.py` |
