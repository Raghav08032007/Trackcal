# Phase 1 test report — reconcile, audit and baseline

Date: 28 October 2026. Branch `codex/phase-4-camera-tracking`. Machine: Windows 11, Node 24.19, Python 3.12 venv, MySQL 8.0.46 (local `global_food_ai`), Chromium from Playwright 1248 / Chrome stable. No new features were built in this phase.

**Simulated vs real:** every camera result below uses Chromium's **fake** media device (`--use-fake-device-for-media-stream`). No physical phone, camera, push service or payment provider was used.

## Results by area

| # | Area | Result | Detail |
|---|---|---|---|
| 1 | Inventory | **PASS** | `docs/INVENTORY.md`: 27 pages, 10 web server routes, 113 + 2 backend endpoints, 57 tables, 0 scheduled jobs, 4 flags, 34 + 4 backend and 8 web environment variables |
| 2 | Status map | **PASS WITH LIMITATIONS** | `docs/STATUS.md`. Six disagreements recorded (D1–D6); the main ones are stack (Next.js/FastAPI, not Vite/Flask), no web push, and deletion/export gaps |
| 3 | Baseline | **PASS** | Owner's numbers reproduced exactly (table below). 3 consecutive full runs; no flaky tests |
| 4 | Lint | **PASS** | 0 errors. 5 warnings → 2 fixed, 3 accepted with reasons (KI-10) |
| 5 | XP ledger integrity | **PASS WITH LIMITATIONS** | (a)–(d) proven (below). Under contention a duplicate request can get a deadlock 500 instead of a clean 0 (KI-01) |
| 6 | Level unlock integrity | **PASS** | Payload fields `level`, `xp`, `unlocked_companions`, `user_id` → 422; query string ignored; locked character → 409; the web reads unlocks only from the server summary, never from browser storage |
| 7 | Camera and privacy | **PASS (SIMULATED camera)** | 16/16 checks at 360 px and desktop (below) |
| 8 | Export and deletion | **FAIL (recorded, not fixed by design)** | 11 user-owned tables missing from the export (KI-03). Deletion is deactivation only (KI-02, Sev-2) |
| 9 | Migrations and backup | **PASS WITH LIMITATIONS** | From scratch and on a data copy: no drift, no rows lost, replay safe. No downgrade path (KI-05). Real `mysqldump` backup and restore drill matched 57/57 tables |
| 10 | Security quick scan | **PASS WITH LIMITATIONS** | bcrypt, HttpOnly/SameSite=Lax/Secure-in-production cookies, CORS allowlist enforced in production, 401 on every private endpoint. Login limit is per email address only (KI-04) |
| 11 | Defects | **PASS** | No Sev-1 code defects. KI-00 (no off-machine source copy) mitigated by local commits. All Sev-2/3 items in `docs/KNOWN_ISSUES.md` with a target phase |

## 3. Baseline counts

| Suite | Owner's report | Run 1 | Run 2 | Run 3 | After Phase 1 |
|---|---|---|---|---|---|
| Backend pytest | 274 | 274 | 278* | 278* | **278 passed** |
| Web vitest | 221 | 221 | 221 | 221 | **221 passed** (39 files) |
| Standalone (`node --test tests/meal-analysis.test.mjs`) | 4 | 4 | — | — | **4 passed** |
| Browser (`tests/e2e-studio.mjs`) | 14 | 14 | — | — | **14 passed**, 0 page errors |
| Browser privacy (`tests/e2e-privacy.mjs`, new) | — | — | — | — | **16 passed** |
| Lint (`eslint .`) | 0 errors / 5 warnings | 0 / 5 | — | — | **0 / 3** |
| TypeScript (`tsc --noEmit`) | — | pass | — | — | **pass** |
| Production build (`next build`) | — | pass | — | — | pass (not rerun; only 2 import lines changed) |

\* Runs 2–3 include the 4 new Phase 1 tests.

## 5. XP ledger integrity

| Requirement | Proof |
|---|---|
| (a) Same event twice → XP once; unique on (user, source type, source id) | Constraint `uq_activity_reward_source (user_id, category, source_id)` and `uq_reward_user_key` present in the **live** schema (`test_ledger_unique_constraints_exist_in_the_live_schema`). The database itself rejects a duplicate (`test_database_rejects_a_duplicate_reward_source`). API replay returns 0 XP (`test_gamification.py::test_workout_idempotency_daily_cap_achievement_privacy_and_manipulation`) |
| (b) Two concurrent requests → once | Two threads, two real committed MySQL connections, released together by a barrier (`test_two_concurrent_requests_for_the_same_event_grant_xp_once`). Exactly one ledger row and 20 XP in every run. 3 of 30 contended runs ended with one side deadlocked and rolled back (integrity held, but the request would see a 500 → KI-01) |
| (c) No XP for body measurements | `test_personalization.py::test_measurements_are_private_timestamped_validated_exportable_and_never_rewarded`; no measurement kind exists in `gamification.KINDS` |
| (d) Caps enforced server-side | `test_gamification.py::test_rule_configuration_global_cap_and_disabled_contracts` (client `xp=9999` → capped at 12); API `xp=99999` → 422 |

## 7. Camera and privacy (SIMULATED camera)

Per viewport (360×780 and 1365×900), all passing:
1. The camera page opens without calling `getUserMedia`.
2. The camera starts only after tapping **Enable camera**.
3. Every media track stops when the tab is hidden (`visibilitychange`).
4. Every track stops on `pagehide`.
5. Every track stops on in-app navigation away (unmount).
6. No request carried video, image, multipart or frame data during the session.
7. Selecting a meal photo without AI consent sends nothing, and the page explains why.
8. **Positive control:** with consent, the analyze request *is* detected. It was intercepted locally, so nothing reached a provider.

Evidence: `docs/phase1-privacy-browser-evidence.json`. Note that tab hiding is simulated by overriding `document.visibilityState`; a real background tab or phone lock needs the manual test below.

## 8. Export coverage

40 tables have a user-owner column. The export (`GET /users/export`) reads 27 models. Missing and needed: `saved_meals`, `user_allergens`, `consent_records`, `ai_scan_jobs`, `food_images`, `food_corrections`, `community_submissions`, `support_tickets`, `coach_bookings`, `subscriptions`, `user_devices`. Justified exclusions: `account_action_tokens`, `auth_identities`, `audit_logs`, `coach_slots` (reasons in KI-03). For a future hard delete, 37 foreign keys to `users` cascade and 3 are `SET NULL`.

## 9. Migrations, backup and restore

`backend/scripts/dry_run_migrations.py` (uses the disposable `trackcal_phase3_test` schema, then rebuilds it):
- **From scratch:** 57 tables, ORM drift none, 54 SQL statements applied twice without error.
- **On a copy of existing data:** 57 tables copied exactly; migrations applied twice; **0 rows lost**, drift none.
- **Downgrade:** not possible (KI-05).

**Backup and restore drill (executed):** `mysqldump --single-transaction --routines --no-tablespaces --set-gtid-purged=OFF` took 2 s (160 KB); restoring into the test schema took 7 s; **57/57 tables matched row-for-row** (611 rows). The dump was deleted afterwards and the test schema rebuilt (0 users).

Procedure for this machine:
```bash
# Backup (put user/password in an options file, never on the command line)
"C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe" --defaults-extra-file=backup.cnf \
  --single-transaction --routines --no-tablespaces --set-gtid-purged=OFF global_food_ai > trackcal-YYYYMMDD.sql
# Restore into an EMPTY database (never over the live one without a fresh backup first)
"C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe" --defaults-extra-file=backup.cnf target_db < trackcal-YYYYMMDD.sql
```
The dump contains private user records: store it encrypted and off the machine. Uploaded images (`backend/uploads`) are not in the dump; copy that folder separately. For Docker deployments use `infrastructure/backup.sh` and `restore-check.sh`.

## Changed files

| File | Change |
|---|---|
| `backend/tests/test_phase1_integrity.py` | New: 4 integrity tests |
| `backend/scripts/dry_run_migrations.py` | New: migration dry run |
| `frontend/web/tests/e2e-privacy.mjs` | New: 16 real-browser privacy checks |
| `frontend/web/tests/fixtures/meal.jpg` | New: synthetic meal photo (generated, no real food or person) |
| `frontend/web/src/components/nutrition-dashboard.tsx` | Removed unused `Nutrients` import |
| `frontend/web/tests/wellness.test.tsx` | Removed unused `waitFor` import |
| `frontend/web/.gitignore`, `.gitignore` | Ignore local runtime logs and unrelated downloaded material |
| `docs/INVENTORY.md`, `STATUS.md`, `KNOWN_ISSUES.md`, `TEST_REPORT_P1.md`, `phase1-privacy-browser-evidence.json`, `SAAS_LAUNCH_ASSESSMENT_20261028.md` | New docs |

Migrations: none. New dependencies: none. The browser tests reuse the Playwright core already installed with the REA tools (outside the repo); portable CI browser setup remains open (`LIMITATIONS_REGISTER.md` P2-13).

## Manual tests the owner must run (NOT VERIFIED)

1. On a real Android phone and an iPhone: open the camera workout, tap **Enable camera**, lock the phone, then switch apps. Confirm the camera light turns off each time.
2. On a phone: deny camera permission, then confirm the page explains how to re-enable it and offers manual entry.
3. Restore a real backup on the target deployment host, including the uploads volume.
4. Decide whether to push the repositories to a private remote (KI-00).
