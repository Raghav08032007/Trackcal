# TrackCal status map — Phase 1 baseline, 28 October 2026

Each blueprint module is marked from the code and from tests run on 28 October 2026, not from earlier reports. **Implemented** means the code exists and automated tests cover it; it does not mean real-device or production verification (see TEST_REPORT_P1.md for what is simulated).

## Where the status report, the blueprint and the code disagree

| # | Claim | Code reality |
|---|---|---|
| D1 | The plan's stack: "React + TypeScript + Vite frontend, Flask backend, MySQL" | **Next.js 16.4.2 (App Router) + FastAPI + MySQL 8.0.46.** The owner chose to migrate to Vite + Flask. **Done: backend 28 October 2026 (Flask 3.1.3, Alembic); frontend 29 October 2026 (Vite 8, React Router 8)** |
| D2 | The plan refers to a 13-phase blueprint | The repository's own plan (`docs/PHASED_IMPLEMENTATION.md`) has phases 0–6, numbered differently. This map uses the module names, which both share |
| D3 | "Reminders" is listed as existing | In-app reminders and calendar (ICS) export exist. **There is no web push**: no service-worker push handler, VAPID keys or sender (0 matches). Closed-app delivery is not possible |
| D4 | "Account controls … export/backup" | **Fixed 28 October 2026 (KI-02, KI-03).** Originally: export omitted 11 user-owned tables (KI-03). "Delete account" only deactivates: it sets `deleted_at` and replies `account_scheduled_for_deletion`, but no job ever deletes (KI-02) |
| D5 | Test counts: 274 backend, 221 frontend, 4 standalone, 14 browser; lint 0 errors / 5 warnings | **All reproduced exactly.** Three consecutive runs, no flaky tests. Phase 1 adds 4 backend tests and 16 browser privacy checks, and fixes 2 warnings |
| D6 | "Six characters unlocking at levels 1–6" | Confirmed: `services/gamification.py` `CHARACTERS` plus milestone unlocks, derived server-side from the XP ledger. Proven tamper-proof in `test_phase1_integrity.py` |

No other gaps were found between the owner's feature list and the code.

## Module status

| Module | Status | Evidence | Notes |
|---|---|---|---|
| Account | **Partial** | `routers/auth.py`, `routers/users.py`; `tests/test_accounts.py`, `test_readiness.py`; web `tests/account-routes.test.ts` | Signup/login/refresh, HttpOnly cookies, verification and reset flows, password change with session revocation. Missing: real deletion (KI-02), complete export (KI-03), real SMTP delivery (external) |
| Nutrition | **Implemented (Phase 2 complete)** | `routers/cloud_nutrition.py`, `foods.py`, `meal_logs.py`, `ai_scan.py`; web `food-workspace.tsx`, `nutrition-dashboard.tsx`; `tests/test_wellness.py`, web `nutrition.test.ts`, `meal-analysis.test.mjs` | Diary, offline journal, reusable meals, food library, recipes, barcode, consent-gated photo scan. Phase 2 in progress: barcode cache + circuit breaker and shared maths module done (2a); IFCT 2017 seed (542 foods, 19 languages, dev/beta only, see `DATA_SOURCES.md`), synonym table, FULLTEXT search, personal ranking, local-name and source display done (2b). Photo upload shrunk and stripped of EXIF in browser and server, AI caps per account/guest/service, portion ranges, time-zone diary days, undo delete, copy yesterday, device-journal import with preview done (2c). See `TEST_REPORT_P2.md` |
| Workouts | **Implemented** | `routers/training.py`, `personalization.py`; `tests/test_personalization.py`, web `wellness.test.tsx` | Exercise library, sessions, weekly plans. Completion is self-reported |
| Camera | **Implemented, experimental (Phase 3: fixtures + simulated browser; real-device accuracy NOT VERIFIED, see `TEST_REPORT_P3.md`)** | `components/camera-workout.tsx`, `lib/pose/*`, `public/pose-worker.js`; `tests/test_camera.py`; `tests/e2e-privacy.mjs` (16/16) | Squat, push-up, curl on-device with MediaPipe. Lifecycle and privacy proven in Chromium with a **fake** camera. No real-device accuracy data (your Phase 3) |
| Social feed | **Implemented (Phase 7, flag `social_feed` off by default)** | `routers/social.py`, migration `0008`; web `app/feed`, `app/profile`, `app/moderation`, `components/social-post.tsx`; `tests/test_social.py`, web `social.test.tsx`, `e2e-p7-social.mjs` | Public profiles and posts (Instagram/LinkedIn style, owner decision), follows with optional private accounts, text + server-verified milestones, reactions with public counts, comments, report/block/mute, auto-hide after 3 reports, moderator queue. No photos, no ranking algorithm, no social notifications yet |
| Communities | **Missing** | No models or routes | — |
| Events | **Missing** | No event or QR check-in models. Rule `verified_event_attendance` exists but is disabled | — |
| Challenges | **Missing** | No models. Rule `verified_challenge_completion` exists but is disabled | — |
| Gamification | **Implemented** | `services/gamification.py`, `services/adventure.py`, `routers/adventure.py`; `tests/test_gamification.py`, `test_adventure.py`, `test_phase1_integrity.py` | Idempotent ledger, server caps, quests, streaks, achievements, six characters. Concurrency safe, but can raise a deadlock 500 under load (KI-01) |
| Companion / reminders | **Implemented (Phase 4, flag `web_push` off by default)** | `services/notifications.py`, `routers/push.py`, `public/sw.js`, `components/push-settings.tsx`, `app-updates.tsx`; `tests/test_push.py`, web `push-ui.test.tsx`, `service-worker.test.ts`, `e2e-p4-push.mjs` | Opt-in web push with time zones, quiet hours, daily limit, pause, two-tap off; installable app with safe update prompt; daily motivation. Real-device push NOT VERIFIED (`TEST_REPORT_P4.md`) |
| Business | **Implemented (Phase 5, flag `billing` off by default)** | `services/billing.py`, `routers/subscriptions.py`, `routers/coaching.py`; web `app/premium/page.tsx`, `lib/billing.ts`; `tests/test_billing.py`, web `premium.test.tsx`, `e2e-p5-premium.mjs` | Premium ₹99/month or ₹799/year with a 7-day first trial via Razorpay Subscriptions; webhook-driven entitlements; coach slots with Premium early access. Real Razorpay Test Mode checkout NOT VERIFIED (no keys yet). No organizer/trainer SaaS |

## Hardening and closed beta (Phase 6)

Content Security Policy and security headers on every page (no violations across all journeys); dependency scan
(npm 0, Python 1 accepted: KI-34); axe WCAG 2.2 AA clean on 36 page views; invite-only sign-up (`closed_beta` flag),
in-app feedback, retention policy, privacy page updated. Go/no-go list: `BETA_RUNBOOK.md`; report: `TEST_REPORT_P6.md`.

## Not in the blueprint, but present

Household integrations (Grocy, Mealie adapters), label OCR and local Whisper speech (need local workers), recipe URL import, pantry and shopping, price observations, PWA manifest and offline guest journal, and the `/guide` interactive test drive.
