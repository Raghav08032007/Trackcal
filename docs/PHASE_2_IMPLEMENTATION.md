# Phase 2 implementation

28 October 2026. Scope: the supplied Phase 2 personalization brief, extending the existing application. Branch `codex/phase-2-personalization` exists in the root and embedded frontend checkouts; pre-existing work was preserved. Phase 3 is not authorized by this implementation.

## Delivered behavior

- Authenticated eight-step onboarding with cloud draft save/resume, revision conflicts, optional questions and measurements, editable preferences, and first-plan creation. Guest three-step setup remains available.
- Private timestamped height/weight, duration, repetitions, frequency, hydration and sleep records. Bidirectional cm/in and kg/lb conversion; original unit/value retained. Optional informational BMI without classification or plan/reward effects.
- Deterministic personal weekly activity plans: eligibility by restrictions/accessibility/equipment/setting, chosen rest days, interests and feedback. Start, complete, skip, reschedule, substitute, pause/resume and regenerate. Completed exercise activities return a compatible entry to the existing account-scoped workout logger. The server plan is the persistent source for that completion.
- Allergy/diet-aware meal ideas, cuisine/preparation/ingredient ordering, substitutions and explicit journal transfer for actual ingredient/portion review. Existing recipe-budget planner is linked; no prices or nutrition quantities are invented.
- Three short, server-scored learning modules: planner use, comfortable movement and nutrition review. First-time onboarding, first saved plan, learning and appropriate completed activities reuse the central XP ledger.
- Five configurable in-app reminder categories, local timezone/day frequency, quiet hours, snooze and dismiss. Existing calendar/ICS reminders and coach booking remain available separately.
- Root companion enhanced with onboarding/plan/dashboard context and plan/reminder shortcuts, retaining existing assets, preferences, achievement celebration and motion controls. No second character renderer or paid companion service.

## Database and API

Additive migration `20261028_02`: `personalization_profiles`, `wellness_measurements`, `activity_plans`, `plan_activities`, `recommendation_history`, `reminder_deliveries`. Profile preferences are bounded validated JSON; equivalent profile/auth/XP tables are reused. User foreign keys cascade; measurement owner/kind/time and plan-owner indexes support reads. Reminder deliveries have a unique user/category/local-day key.

Run `backend/scripts/migrate_personalization.py` as a release job. Equivalent table DDL is in `backend/migrations/20261028_02_personalization.sql`; the Python job also creates indexes and seeds missing centralized definitions without overwriting configured rules. Legacy row-count preservation and replay were tested. Existing profile measurement fields are retained rather than backfilled with fabricated timestamps.

Routes under `/api/v1/personalization`: GET state/reminders; POST onboarding/measurements/plans/education; POST plans/{id}, activities/{id}, reminders/{id}; DELETE measurements/{id}. The same-origin Next proxy allowlists paths/methods, authenticates through HttpOnly cookies and bounds request size. Backend validates ownership, types, local dates, revisions, equipment eligibility, rest-day substitutions, rate limits and reward IDs.

Account export includes owned preferences, measurements, plans, activities, recommendation history and reminder deliveries. Measurement deletion is supported; account deactivation still follows the existing retention policy rather than promising immediate erasure.

Rollback: MySQL DDL is additive and may implicitly commit. Do not run destructive downgrade SQL. Application rollback may retain the new tables and records; validate the intended older build and restore only from an approved tested backup when needed. Request writes are transactional; test writes use rollback-only sessions.

## Principal files

Backend: models.py; main.py; routers/personalization.py and users.py; services/personalization.py, personalization_inputs.py and gamification.py; scripts/migrate_personalization.py; migration SQL; tests/test_personalization.py.

Frontend: lib/personalization.ts, use-personal-state.ts and nutrition.ts; onboarding/page.tsx, plan/page.tsx, page.tsx, routine/page.tsx, layout.tsx and API personalization catch-all; components/personal-onboarding.tsx, legacy-onboarding.tsx, personal-dashboard.tsx, measurement-entry.tsx, personal-reminder-fields.tsx, personal-reminder-inbox.tsx, meal-idea-transfer.tsx and journey-companion.tsx; globals.css; personalization, proxy and safety tests. The existing companion test's fetch fixture was made route-aware; assertions were retained.

## Performance and costs

No new dependency, paid inference call, external push service or payment activation. Recommendations use a small local catalog; polling is once per minute while visible and on focus. This adds database storage and account-scoped queries. No production latency/capacity or hosting cost benchmark is claimed. Summary caching, aggregation and larger catalogs remain in the limitations register.

## Verification and handoff

Baseline before implementation: 180 backend tests, 170 frontend tests; no baseline application failures. See PHASE_TEST_REPORT.md for final counts, runtime evidence, resolved defects and unverified physical-device/assistive-technology coverage. Every Phase 2 limitation is recorded in LIMITATIONS_REGISTER.md. This phase does not certify public paid-launch readiness. Phase 3 requires separate user approval.
