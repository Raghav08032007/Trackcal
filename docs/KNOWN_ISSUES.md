# TrackCal known issues — Phase 1, 28 October 2026

Severity, per the Phase 1 rules: **Sev-1** data loss, security or privacy; **Sev-2** feature broken or missing; **Sev-3** polish. Phase 1 fixes only Sev-1 items and Sev-2 items that block later phases. Everything else is recorded here with a target phase. The long-standing launch gates in `LIMITATIONS_REGISTER.md` still apply; this file holds the issues found or confirmed by the Phase 1 audit.

## Open issues

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-00 | 1 | **No off-machine copy of the source.** Until today only 27 files were committed; `frontend/web` is a nested repo with no remote | `git ls-files`, `git remote -v` | **Mitigated:** all work is committed locally (`ee92db33`, web `135a6ff`). Pushing to a private remote is the owner's call |
| KI-01 | ~~2~~ **Resolved** | Concurrent XP awards can fail with a MySQL deadlock (1213) and return a 500. Integrity holds: the victim is rolled back and XP is never double-granted | `test_phase1_integrity.py::test_two_concurrent_requests_for_the_same_event_grant_xp_once`: 3 deadlocks in 30 runs while other test transactions held gap locks; 0 in 52 runs alone | Fix in the Flask port: retry the award transaction on 1213 (bounded, idempotent), or use READ COMMITTED for award transactions |
| KI-02 | ~~2~~ **Resolved** | Account "deletion" only deactivates. `DELETE /users/account` sets `deleted_at` and `is_active=false` and replies `account_scheduled_for_deletion`, but no job ever deletes. App stores and the DPDP Act require real erasure | `routers/users.py:167-181`; no purge job in `scripts/` | Build after the Flask port: purge job, cascade 37 tables, anonymize the 3 `SET NULL` tables (`audit_logs`, `community_submissions`, `support_tickets`), and honest response copy |
| KI-03 | ~~2~~ **Resolved** | Account export omits 11 user-owned tables: `saved_meals`, `user_allergens`, `consent_records`, `ai_scan_jobs`, `food_images` (metadata), `food_corrections`, `community_submissions`, `support_tickets`, `coach_bookings`, `subscriptions`, `user_devices` | `routers/users.py:185` compared with `Base.metadata` (TEST_REPORT_P1.md §8) | Add to the export during the Flask port. Justified exclusions: `account_action_tokens` (secret digests), `auth_identities` (token hashes; export the provider name only), `audit_logs` (security record, available on request), `coach_slots` (owned by the coach) |
| KI-04 | ~~2~~ **Resolved** | Login is rate-limited only per email address, and only when `APP_ENV=production`. There is no per-IP limit, so one password tried across many accounts is not throttled | `routers/auth.py:127-130, 185` | Add per-IP and global login buckets during the Flask port |
| KI-05 | ~~2~~ **Resolved** | Migrations cannot be reversed: plain additive SQL with no down scripts. Master Rule 2 requires reversible migrations for every later phase | `backend/migrations/*.sql`; dry run in TEST_REPORT_P1.md §9 | **Blocks later phases.** First task of the Flask port: adopt Flask-Migrate (Alembic), using the current 57-table schema as the baseline revision |
| KI-06 | ~~2~~ **Resolved** | No per-module feature-flag system. Master Rule 8 requires every new module behind a flag that defaults to off in production. Only two AI environment flags and per-rule `gamification_rules.enabled` exist | INVENTORY.md "Feature flags" | **Blocks later phases.** Add a small server-side flag table and client hook during the Flask port, before any new module |
| KI-07 | 2 | Production AI uses free OpenRouter models, which may log or train on meal photos and descriptions | `OPENROUTER_MODEL=openrouter/free` in README local mode; `app/api/analyze/route.ts` | Owner decision before public launch: a paid no-retention model, or a consent notice that names the provider's terms |
| KI-08 | ~~3~~ **Resolved (Phase 6)** | `/api/analyze` is unauthenticated and unlimited outside production, and in production when `ENABLE_LOCAL_AI=true` | `app/api/analyze/route.ts:8` | Phase 2 added per-account, per-guest and service-wide daily caps in every environment; photos are shrunk and stripped first |
| KI-09 | ~~3~~ **Resolved** | Migration file order: `20261028_gamification_foundation.sql` sorts after the files that depend on it. Harmless today because `bootstrap_schema.py` runs `create_all` first | Dry run | Superseded by Alembic (KI-05) |
| KI-10 | 3 | Accepted lint warnings (2 since the Vite migration removed the Next `<img>` rule; originally 3): `camera-workout.tsx:22` (ref is a request counter, not a DOM node), `journey-companion.tsx:29` (guarded one-shot effect), `nutrition-dashboard.tsx:24` `<img>` (local `blob:` photos) | `npx eslint .` | Re-check after the Vite migration; the `<img>` warning is Next-specific |
| KI-11 | ~~3~~ **Resolved (Phase 6)** | About 1,800 deprecation warnings per backend run, now almost all `datetime.utcnow` (the Starlette TestClient warnings left with FastAPI) | pytest output | `timeutil.utcnow()` replaces all 59 `datetime.utcnow` uses in app code; warnings per run 3,156 → 463 (the rest are from tests and libraries) |
| KI-12 | 3 | `POST /scan/adjust-cooking-style` is public. It is pure arithmetic with no database or provider call | `routers/ai_scan.py:348` | Acceptable; keep public or add a light rate limit |

## Found during the frontend migration (29 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-13 | 3 | `tests/test_api.py::test_barcode_lookup_endpoint` can reach the live Open Food Facts API ("mock or live"), so it depends on the network | Test docstring; about 1.8 s per run | Stub the provider in Phase 2 (barcode reliability), which rewrites this path |
| KI-14 | 3 | The browser privacy check is flaky with Chromium's fake camera: 13 of 16 runs passed after each viewport got its own browser. Failures were browser-side (the fake device reporting "Requested device not found", or an early failure that did not reproduce); server logs showed no errors | `docs/phase1-privacy-browser-evidence.json` records retries and the page text on failure | Re-run on a CI browser image; confirm camera lifecycle on real phones (manual test list) |

## Found during step 4 (29 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-15 | ~~2~~ **Resolved (Phase 6)** | `GET /adventure/summary` locks the user row (`SELECT … FOR UPDATE`) on every read, because it can also persist newly earned achievements. Reads queue behind each other and behind account changes. The client now sends one request per page (fixed), but the server design remains | Staircase timings (0.7 → 1.9 s) for three concurrent reads; 56 s password change under SQL echo | Summary reads run lock-free first and fall back to the locked path only when something new must be saved (`services/read_only.py`; test proves no locks on a steady-state read) |
| KI-16 | ~~3~~ **Resolved (Phase 6)** | `APP_ENV=development` turns on SQL echo for every statement, which slows a busy server dramatically (52,000 log lines in one test session) | Test server log | SQL echo is opt-in (`SQL_ECHO=1`) |

## Found during Phase 2 (29 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-17 | 3 | Copying device-journal meals: two meals on the same day with the same time, name and calories count as one meal (the id is derived from that content so a repeated copy never duplicates) | `device-journal-import.tsx`, `tests/diary-tools.test.tsx` | Accepted; the preview lists exactly what will be copied |
| KI-18 | 3 | The guest AI cap (5 a day) is per client address, so people sharing one address (college Wi-Fi, office NAT) share it. Signed-in people have their own cap | `web_gateway._ai_allowance`, `tests/test_photo_scan.py` | Phase 10 (hardening): decide whether guests get AI at all |
| KI-19 | 3 | The portion range is only as good as the model: if a model ignores `quantity_g_low/high`, the range is a band derived from confidence and the UI says so. Not measured against real meals | `services/meal_analysis.py` | Owner: try 20 real photos with the configured free models before beta |
| KI-20 | 3 | `scripts/setup_phase3_test_db.py` does not create the Phase 3 browser fixture; `scripts/seed_phase3_e2e.py` must be run after it | Phase 3 journey failed until the seed was run | Run both (recorded in `TEST_REPORT_P2.md`) |

## Found during Phase 3 (29 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-21 | 2 | Rep-counting accuracy has not been measured on real people or phones. All three exercises are labelled **Experimental** in the app until the manual device matrix meets the target (90% of sets within ±1 rep) | `TEST_REPORT_P3.md` device matrix is empty | Owner: run the matrix; remove the label per exercise only if it meets the target |
| KI-22 | 3 | No MoveNet fallback for low-end phones. Slow devices step down 24 → 15 → 10 fps, then stop with a "use manual logging" message. MediaPipe Pose *lite* is already the lightest MediaPipe model | `detection-service.ts` | Add MoveNet (`@tensorflow-models/pose-detection`, Apache-2.0) only if the device matrix shows low-end phones failing; it needs its own threshold calibration |
| KI-23 | 3 | The fixtures are synthetic skeletons posed from known angle curves, not recordings of people. They prove the counting logic, not real-world accuracy | `tests/fixtures/pose/generate.mjs` | Add recorded landmark sequences (landmarks only, with consent) from the device matrix runs |
| KI-24 | 3 | `e2e-p3-camera.mjs` passed 17 of 19 runs with Chrome's fake camera; the 2 failures were not reproducible (same family as KI-14) | Phase 3 runs | Watch in CI; re-run on failure before investigating |

## Found during Phase 4 (29 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-25 | 2 | Real push delivery is not verified on a phone or after the app has been closed for hours. Headless Chrome cannot subscribe to a push service, so the browser journey fakes `pushManager.subscribe`. Encryption and VAPID signing are proven against a local receiver | `TEST_REPORT_P4.md` manual checklist | Owner: Android Chrome, one desktop browser, one installed iOS app, before turning the flag on for beta |
| KI-26 | 2 | Scheduled notifications need the tick every minute. On free hosting the app sleeps, and GitHub Actions schedules run at most every 5 minutes, often late | `PUSH_NOTIFICATIONS.md` | Before launch: an always-on worker or a paid plan that doesn't sleep |
| KI-27 | 3 | `VAPID_SUBJECT` in `backend/.env` is a placeholder (`mailto:push-admin@example.com`) | `.env` | Owner: set a real contact before enabling push |
| KI-28 | 3 | `vite-plugin-pwa` was not adopted: the existing hand-written service worker was extended instead (it already never caches private data). Built assets are not precached for offline use; offline still serves the journal page | `public/sw.js` | Revisit if full offline use of the app shell is wanted |
| KI-29 | 3 | `pywebpush` and `py-vapid` are MPL-2.0 (file-level copyleft). Used unmodified, which is compatible with closed source; any change to their files must be published | `requirements.txt` | Keep unmodified; note in the third-party notices |

## Found during Phase 5 (29 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-30 | 2 | No real Razorpay call has been made: checkout and cancel were tested with a simulated gateway (signatures checked for real). Request shapes follow the SDK and Razorpay's Subscriptions API but haven't met the real service | `TEST_REPORT_P5.md` | Owner: Test Mode keys + plans + webhook, then the manual checklist |
| KI-31 | 2 | GST, terms of sale and a refund policy are not decided or published; Razorpay Live activation needs them | `BILLING.md` | Owner, before Live keys |
| KI-32 | 3 | If the browser closes between Razorpay success and our verify call, Premium starts only when the webhook arrives (`subscription.authenticated`/`activated`), usually within seconds | `services/billing.py` | Accepted; the webhook is the source of truth |
| KI-33 | 3 | The trial-end reminder is in-app (account page) plus Razorpay's own customer emails; no push notification for it yet | `premium-notice.tsx` | Add a `billing` notification type if beta users miss it |

## Found during Phase 6 (29 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-34 | 3 | `nltk` 3.10.3 (pulled in only by the optional recipe-ingredient parser) has two advisories: GHSA-j456-xh4h-cpf2 (fixed in 3.10.4, released 21 Oct 2026, under the two-week rule) and GHSA-8mgp-746c-j5xp (no fix yet). TrackCal never passes user input to the affected model-loading or Weka APIs | OSV scan, `TEST_REPORT_P6.md` | Upgrade to 3.10.4 after 4 November 2026; recheck OSV monthly |
| KI-35 | 3 | The browser journeys now take their URLs from `TRACKCAL_E2E_URL` / `PHASE3_TEST_URL` / `TRACKCAL_API_DIRECT`; defaults still point at 3003/8003, which another local tool was using during Phase 6 | `tests/*.mjs` | Set the variables when running them |

## Found during Phase 7 (29 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-36 | **1 (launch gate)** | Owner decision: no extra rules for under-18s in a public feed. Adults can find, follow and comment on teenagers' public posts. India's DPDP Act 2023 requires verifiable parental consent before processing a child's (under-18) personal data, and app stores expect child-safety measures for social features. Safety tools exist for everyone (private accounts, block, mute, report, auto-hide, moderation) | `TEST_REPORT_P7.md` | Owner, with legal advice, before the feed is enabled for real users: parental consent flow, or an under-18 restriction, or keep the feed adults-only |
| KI-37 | 2 (part resolved 19 Nov 2026) | Moderation still needs people: nobody is assigned and there is no response-time target. **Done:** a word screen (`services/screening.py`, list in `data/screening.json`, 10 languages) holds posts, comments, events and challenges with slurs, abuse or self-harm phrases for review, shows a helpline in the person's language for self-harm words, and refuses such words in community names and profiles | `tests/test_screening.py` | Owner: assign moderators and a response time; extend the word list from real reports; get the helpline message reviewed by a mental-health professional |
| KI-38 | 3 | No notifications for follows, comments or reactions; people find them by opening the feed | — | Add opt-in `social` notification types if the beta asks for them |
| KI-39 | 3 | Discover is newest-first public posts with no ranking or spam scoring; at scale it will need pagination by recency windows and spam controls beyond rate limits | `feed()` | Revisit after the beta |

## Found during Phase 8 (29 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-40 | 2 | Community owners and moderators are volunteers with real power over who belongs. There is no appeal path for a person banned from a community, and no site-level view of how communities are moderated | `routers/communities.py` | Before enabling: an "appeal to TrackCal" link on the ban notice, and a site admin list of communities with open-report counts |
| KI-41 | 3 | Anyone with a feed profile can create a community (5 each); names and descriptions aren't screened beyond reports | — | Add communities to the keyword pre-screen planned in KI-37 |
| KI-36 | — | The under-18 launch gate (Phase 7) applies to communities too | KI-36 | Decide once for feed and communities |

## Found during the visual pass and Phase 9 (30 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-42 | 3 | Photos are CC BY / CC BY-SA from Wikimedia Commons: the credits page must stay reachable (footer link) and the photos must not be used in ads or app-store screenshots without checking each licence | `public/photos/credits.json`, `/credits` | Keep the link; owner to review before marketing use |
| KI-43 | 3 | `e2e-p6-hardening.mjs` still fails about 1 run in 9 (after fixing the companion-over-footer overlap that caused most failures) | Phase 9 runs | Same family as KI-14/KI-24; rerun before investigating |
| KI-44 | ~~2~~ **Resolved (19 Nov 2026)** | Events have a report button (event page, same moderation queue as posts) and the server refuses locations that read like a home address (flat, apartment, house/door/plot number, "my place", in English, Indian languages, Spanish, Portuguese, Indonesian and Arabic) | `routers/events.py` `looks_private()`, `tests/test_events.py` | Moderators still review reports by hand; a free-text address that avoids these words can get through |
| KI-45 | 3 | A QR code photographed and sent to someone outside works for up to about 60 seconds (current + previous 30 s window). Remote check-in remains possible within that minute | `routers/events.py` | Accepted for beta; tighten to the current window or add location only if abuse shows up |
| KI-46 | 3 | No event reminder notifications yet (the push types don't include events) | `services/notifications.py` | Add an `event` type once events are on |
| KI-47 | 3 | Another session's files (`Makefile`, `tools/`, `docs/bench/`) are untracked in this repo; one commit included `docs/bench/` by mistake and the next untracked it | `git log` | Owner: decide whether those belong in the repo |

## Found during Phase 10 (30 October 2026)

| ID | Sev | Issue | Evidence | Plan |
|---|---|---|---|---|
| KI-48 | 3 | Progress settles when the person opens the challenge page, so XP for finishing arrives on the next visit, not the moment the last workout is saved | `routers/challenges.py` | Accepted; add a settle call to the diary/workout save paths if people find it confusing |
| KI-49 | ~~3~~ **Resolved (19 Nov 2026)** | Flagged challenge entries now appear on `/moderation`, where a moderator clears the flag or removes the entry; the decision is kept (`flag_reviewed_at`, migration 0027) so the flag isn't raised again. XP is never taken back | `routers/social.py` `flagged_entries()` / `moderate_entry()`, `tests/test_item_reports.py` | Apply migration 0027 before release |
| KI-50 | 3 | `e2e-p6-hardening.mjs` passes 6/6 alone but still fails now and then when run straight after the other 12 journeys (KI-43) | Phase 10 runs | Investigate with a captured trace when it next fails |

## Resolved during the backend migration (28 October 2026)

| ID | Resolution | Evidence |
|---|---|---|
| KI-05 | Alembic baseline `0001` (exact Phase 1 schema) and `0002`; release job stamps pre-Alembic databases and upgrades | `scripts/dry_run_migrations.py`: upgrade, downgrade and re-upgrade on scratch and a data copy, 0 rows lost, no drift |
| KI-06 | `services/feature_flags.py`, `feature_flags` table, operator CLI; all flags off by default | `tests/test_feature_flags.py` (4) |
| KI-09 | Superseded by Alembic; old SQL files frozen (`backend/migrations/README.md`) | — |
| KI-F5 | Phase 1 privacy test race (positive control missed fast requests, about 50% of runs) | 14 consecutive 16/16 runs |

| KI-01 | Deadlocked requests on the four XP blueprints rerun up to 3 times with backoff; exhaustion returns a retryable 503 instead of a 500 | `tests/test_deadlock_retry.py` (4) |
| KI-02 | `services/account_erasure.py` and the daily `account-purge` service erase closed accounts after `ACCOUNT_ERASURE_DAYS` (30), including photo files and the 3 `SET NULL` tables; closure reports the erasure date; notices updated | `tests/test_account_erasure.py` (5): nothing left in any table, other accounts untouched, no file outside uploads deleted |
| KI-03 | Export adds 11 sections (`account_records`), omitting only credentials; a coverage register fails tests when a new user-owned table is neither exported nor excluded with a reason | `tests/test_export_coverage.py` (2) |
| KI-04 | Per-IP login (30 / 15 min) and signup (10 / h) buckets; `TRUSTED_PROXY_HOPS` with `ProxyFix`; the web server forwards the proxy-recorded address | `tests/test_ip_limits.py` (4), web `tests/forwarded-for.test.ts` (2) |

## Fixed in Phase 1

| ID | Fix | Verification |
|---|---|---|
| KI-F1 | Removed 2 unused imports (`nutrition-dashboard.tsx`, `tests/wellness.test.tsx`). Lint: 0 errors, 5 → 3 warnings | `npx eslint .`, full web suite |
| KI-F2 | Added missing proofs: database-level duplicate rejection, real two-connection concurrency, and tampering through extra fields and the query string | `tests/test_phase1_integrity.py` (4 tests) |
| KI-F3 | Added a real-browser privacy check with positive and negative controls | `frontend/web/tests/e2e-privacy.mjs` (16 checks) |
| KI-F4 | Added a reproducible migration dry run | `backend/scripts/dry_run_migrations.py` |
