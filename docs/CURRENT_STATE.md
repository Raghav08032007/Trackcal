# TrackCal 4.0 — current state

Audit date: 28 October 2026. The explicit chat request authorized a bounded visual 3D-style UI refinement. The attached Phase 0 restriction is retained for future product modules: no social feed, events, camera exercise tracking, database migrations or subscriptions were implemented by this pass.

## Decision

Extend the existing application. Preserve the working nutrition, account, backup, planner, coaching and gamification code and user data. A rebuild would discard verified behavior without solving the outstanding operational needs.

## Existing system

- Next.js 16.4.2 / React web app in frontend/web; App Router pages for dashboard, tools, play, routines, progress, onboarding and accounts.
- FastAPI modular API, SQLAlchemy/PyMySQL and MySQL. Routers include auth, users, foods, meal logs, scans, recipes, nutrition, support, food submissions, coaching, integrations, adventure and subscription status.
- Nutrition journals/preferences use account-scoped browser storage and IndexedDB recovery; explicit cloud snapshots support revision checks. This is not transparent continuous multi-device synchronization.
- AI text/photo analysis uses server-side provider calls; OCR and Whisper adapters need local workers/models. Food data uses Open Food Facts and USDA.
- Character state is derived from server XP. Existing detailed character assets remain unchanged; level 1–6 unlocks and full-day task streaks are retained.
- Existing Expo/mobile material is not certified as a production mobile product.

## Verification and unknowns

Latest prior backend report: 168 tests passed. This visual pass adds pointer-depth tests and runs the web suite/build/lint. No live database, secret values, customer measurements or paid-provider credentials were inspected for this audit. ORM model declarations do not prove every table is deployed. Camera preview was repaired and observed previously; it is not re-certified on every physical device by this pass.

SMTP delivery, public HTTPS deployment, payment processing, Docker runtime/recovery drills, independent nutrition accuracy, real-device accessibility and customer retention remain launch evidence gaps. See FEATURE_MATRIX.md and existing dated verification reports.

Visual pass outcome: 166 web tests, build, TypeScript and lint passed. Desktop/character/mobile dark runtime captures completed without page errors. Details and limits are in [UI_UX_REDESIGN.md](UI_UX_REDESIGN.md).

## Button-first home and companion guidance — 28 October 2026

The latest UX follow-up split home destinations into click-through cards, gave each food tool a focused route, made page-level Pip guidance optional, and repaired offline journal wrapping. It retains the no-new-navigation-bar direction and server-controlled character unlocks. Final rerun: 274 backend tests, 221 frontend tests, four standalone Node checks, 14 production-browser checks, TypeScript and build pass; lint has zero errors/five known warnings. See [UX_HOME_REORGANIZATION_20261028.md](UX_HOME_REORGANIZATION_20261028.md). Physical-device, camera hardware/accuracy and assistive-technology testing remain unverified. No Phase 5 or deployment.

## Phase 1 gamification completed — 28 October 2026

The central reward engine reuses MySQL profiles/XP ledger and adds configurable rules, idempotent audit events, persistent achievements, cosmetic unlocks and rest/protection records. Existing nutrition review, education, feasible planning and explicit workout self-reviews feed it. Shared authenticated companion controls and dashboard progress use backend state. Future modules are disabled contracts. See PHASE_TEST_REPORT.md, GAMIFICATION_ARCHITECTURE.md and GAMIFICATION_RULES.md for acceptance evidence and limitations. Phase 2 remains unstarted pending approval.

## Consolidated limitations backlog

[ LIMITATIONS_REGISTER.md ](LIMITATIONS_REGISTER.md) is the cross-phase record for deferred fixes, evidence gaps, external prerequisites and intentional boundaries. Update it at every phase handoff and use it for the final rectification pass after all approved phases.

## Phase 2 personal wellness handoff — 28 October 2026

Eight-step authenticated onboarding, optional private measurements/conversion/BMI arithmetic, deterministic weekly activity plans, nutrition ideas, in-app reminders and Phase 1 gamification/companion integration are delivered. Final local verification: 219 backend tests, 181 frontend tests, lint, TypeScript, production build and desktop/mobile/tablet browser journeys. The final reminder layout fix was rebuilt and verified in the real tablet flow. Physical-device/assistive-technology/clinical and public launch limitations remain explicitly recorded; see PHASE_TEST_REPORT.md and LIMITATIONS_REGISTER.md. Phase 3 remains unstarted pending approval.

## Phase 3 local handoff — 28 October 2026

Cloud nutrition and detailed workout sessions, reusable meals/favorites, manual scanner confirmation and explicit AI consent, linked-plan completion, shared participation rewards, seven-day history, larger typography and optional character motion are delivered. Verification: 259 backend tests in the dedicated test schema, 191 frontend tests, lint/TypeScript/build, and isolated desktop/mobile/tablet browser journeys. See PHASE_3_IMPLEMENTATION.md and PHASE_TEST_REPORT.md. The device journal/workouts and previous features remain available. All limits remain in LIMITATIONS_REGISTER.md. Phase 4 is unstarted pending approval.


## Phase 4 camera implementation — 28 October 2026

Dedicated `codex/phase-4-camera-tracking` branches. Adds local-only camera-assisted squat/push-up/curl estimates, review/correction, existing-session persistence/plan linkage, capped central rewards/participation achievements and the existing companion in reserved space. No recording/video uploads/microphone. Existing stacks/features retained. Real model inference on a public static person image and deterministic/synthetic browser tests are distinguished from physical-device/accuracy acceptance, which is NOT VERIFIED. See PHASE_4_IMPLEMENTATION.md and PHASE_TEST_REPORT.md. No Phase 5 work.

## Studio UI/UX refresh — 28 October 2026

New ink/lavender shared design, dimensional character stage, navigation improvements and interactive /guide manual test drive are delivered. Global footer appearance/reduced-motion settings reuse existing preferences. Existing Phases 0–4 and character identities/data boundaries retained. Verification: 274 backend + 216 frontend + four Node tests; 55 browser checks; production build/TypeScript pass, lint zero errors/five known warnings. See STUDIO_REDESIGN_20261028.md. App restored at localhost:3002. No Phase 5 work or deployment.

