# Phase 3 implementation — nutrition, sessions and readable engagement

28 October 2026. Branch codex/phase-3-nutrition-workouts in the root and embedded frontend checkouts. Extends the existing stack; no rebuild and no Phase 4 work. Global requirements are preserved in GLOBAL_UX_REQUIREMENTS.md and linked from README.md.

## Delivered

- `/nutrition`: owned cloud food diary, breakfast/lunch/dinner/snack/drink/other groups, explicit date selection, editable portions/nutrients, recent foods/history, favorites, reusable multi-food meals, source/estimate labels and Phase 2 meal ideas/education/planner shortcuts.
- Local catalog search with prefix/alias/translation matching, category filter, pagination, bounded substring fallback, own recent searches and regional-name hints (Idli/Dosa/Sambar/Chapati/rice/dal/international names). Names without composition data never acquire invented values. Existing public food lookup remains explicit.
- Photo review defaults to a local-only reference with manual food selection and correction. The original scanner/barcode tools remain. Existing AI photo analysis now requires explicit transfer consent; camera/file options, uncertainty, manual correction and deletion are described in FOOD_SCANNER_SPEC.md.
- `/workouts`: reviewed exercise search/filter/details, actual equipment/accessibility/safety/alternatives, favorites/saved workout blueprints, personalized-plan starters, persistent resumable sessions, sets/reps/resistance/duration/notes, replacement, incomplete history, corrections, deletion, optional silent rest timer and an actual seven-day completion calendar.
- Central reward integration: diary review shares existing meal caps; first reusable meal grants the configured first-time reward; planned/manual/session completions share workout source IDs/caps. New Food Explorer, Wellness Learner and Recovery Champion achievement definitions derive from real records.
- Existing shared companion gains nutrition/session shortcuts, actual achievement/level reactions and gentle bounded CSS motion. Mute/celebration disable, minimize, dock side, disable, calm mode and OS reduced motion remain available. No second companion or heavy renderer.
- App-wide typography increased to an 18px base, 17px on mobile, with rem-based readable supporting text, native controls and 44px button targets. New cards use existing green materials, depth and lightweight transitions. Header shortcuts reduce trips through the footer.

## Preserved boundaries

The existing device journal/local workout records, recipe tools, AI/barcode interfaces, onboarding, personal plans, measurements, calendar reminders, coaching and backups remain. Cloud nutrition/session history is explicitly labeled rather than silently importing or overwriting private device records. Unknown nutrient values remain unknown; no body/intake/volume rewards or automatic exercise-intensity increase.

## Database and APIs

Reused `foods`, `food_nutrients`, `food_translations`, `custom_foods`, `meal_logs`, `meal_items`, `saved_meals`, personal plans and all existing reward tables. New tables only: `food_aliases`, `food_favorites`, `food_search_history`, `workout_blueprints`, `workout_sessions`. Sessions hold bounded JSON exercise/set snapshots; no duplicate XP or activity-history table. User foreign keys cascade, sessions have an owner/start index and unique optional plan-activity reference, favorites/searches have owner/key uniqueness, aliases have indexes, and foods have a category/name index.

Migration: `backend/scripts/migrate_wellness.py`, version `20261028_03`; SQL reference in migrations/20261028_03_nutrition_workouts.sql. It creates missing structures, seeds missing reward definitions and aliases only for existing catalog foods, and verifies legacy row counts. No destructive downgrade or invented nutrient seeds. Fresh bootstrap uses the updated ORM/seed definitions. Rollback of request writes is transactional; schema rollback retains additive tables and requires a controlled application/backup procedure rather than DROP statements.

New authenticated `/api/v1/wellness` resources: foods/details; diary GET/POST/PUT/DELETE; saved-meals POST/DELETE; favorites POST/DELETE; exercises/details; templates POST/DELETE; sessions POST/GET/PUT/DELETE; training GET. Lists are included in diary/training responses; pagination limits and owner scopes apply. Next's catch-all wellness proxy allowlists paths/methods/query fields, bounds JSON size and rejects foreign-origin mutations. `/api/v1/scan/images/{id}` deletes owned stored image files under a checked upload root. Real-provider photo POSTs require consent; this is an intentional safety input requirement for existing API clients.

## Files and dependencies

Backend models/main, routers cloud_nutrition/training/users/ai_scan, services wellness_inputs/gamification, additive migration and test setup/fixture/benchmark scripts; tests/test_wellness.py. Frontend nutrition/workout pages, wellness request types/proxy, dashboard components, root/layout/companion/touch feedback, storage validation and shared CSS; unit/proxy/scanner/E2E tests. No new application dependency or paid service. The browser harness reuses the already installed Playwright/Chrome runtime and accepts TRACKCAL_PLAYWRIGHT_PATH for another compatible installation.

## Verification / cost / next phase

Final tests and measured observations are in PHASE_TEST_REPORT.md. Dedicated MySQL schema trackcal_phase3_test contains only public reference copies and synthetic test records; customer records are not used by the new integration/browser tests. Root credentials were used only for local test-schema provisioning and were not saved in the project.

No AI inference request was made in browser acceptance; no new paid provider introduced. Optional existing inference, server/database storage and remote public catalog availability still have operating dependencies. Loopback timings are measured on a small catalog, not production-load or physical-phone certification. All unresolved limits are retained in LIMITATIONS_REGISTER.md. Phase 4 requires explicit approval and has not started.
