# Phase 4 test report: reminders, installable app and web push

Date: 29 October 2026. Branch `codex/phase-4-camera-tracking`. Windows 11, Node 24.19, Python 3.12, MySQL 8.0,
headless Chrome stable. Browser journeys on the disposable `trackcal_phase3_test` schema.

**Simulated vs real:** no phone and no real push service. Headless Chrome refuses `pushManager.subscribe`
("Registration failed - permission denied"), so the browser journey fakes that one call. Everything around it is
real: permission handling, the API, the database, the UI. The sending path is proven with **real** pywebpush
encryption and VAPID signing against a local receiver that decrypts the message. **Delivery to a real device is NOT
VERIFIED** (checklist below). The feature ships **off** (`web_push` flag).

## Results by step

| # | Step | Result | Detail |
|---|---|---|---|
| 1 | PWA basics | **PASS WITH LIMITATIONS** | Manifest, 192/512/maskable icons and offline page already existed. Service worker never caches API or account responses (tested). Updates now **wait**: an "Update now / Later" bar that stays hidden while a workout or camera session is active. Install button appears only when the browser offers install. Kept the hand-written worker instead of vite-plugin-pwa (KI-28) |
| 2 | VAPID | **PASS** | One key pair generated into git-ignored `backend/.env` (never printed). Only the public key is served (`/api/push/config`). Rotation documented in `PUSH_NOTIFICATIONS.md`. Subject is a placeholder (KI-27) |
| 3 | Subscription API | **PASS** | `POST/DELETE /api/push/subscribe`, authenticated, HTTPS endpoints only, unique per endpoint (hash), user agent and time stored per device; the same browser signing in as someone else moves the device. `pushsubscriptionchange` re-subscribes and replaces the old endpoint (tested) |
| 4 | Permission UX | **PASS** | Explainer first ("what you'll get, how to stop"); the browser prompt only after a tap (journey counts 0 prompts on load, 1 after the tap); blocked → how to re-enable, no repeat prompt. Existing in-app reminders and companion settings unchanged |
| 5 | Preferences | **PASS** | Six types (today's plan, activity, meal check-in, rest-day note, a thought for today, milestones), per-type on/off and time, max per day (default 2, 1–5), pause a day/week, global off. Time zone and quiet hours reuse the existing preferences. Copy has no guilt, streak pressure, numbers or health words (tested) |
| 6 | Scheduler | **PASS** | `scheduled_notifications` with a unique idempotency key; due rows claimed with `FOR UPDATE SKIP LOCKED`; local times from the IANA zone daily (DST gap and overlap tested) |
| 7 | Free-tier warning | **PASS** | `POST /internal/tick` behind `X-Tick-Secret` (≥ 32 chars, constant-time compare, 404 otherwise); edge route added; documented that GitHub schedules are ≥ 5 min and an always-on worker is needed before launch (KI-26) |
| 8 | Sending | **PASS** | Payload = title, neutral body, link, id. TTL 4 h. 404/410 deletes the device; 5xx/429/network retries at 2/4/8/16 min, then failed; 4xx failed. Logs carry only status and type |
| 9 | Daily motivation | **PASS** | 40 original lines (`backend/data/motivation.json`), rotated by date, shown on the Routine page and as an optional notification |
| 10 | Platform limits | **PASS** | iOS/iPadOS: Home Screen install from Safari, 16.4+ (checked against current guidance, sources in `PUSH_NOTIFICATIONS.md`); desktop and Android Chrome in the browser; unsupported or blocked → in-app reminders |
| 11 | Metrics | **PASS** | `GET /internal/notification-metrics`: opt-ins, opt-outs, devices, failure rate, open rate (opens recorded from the notification click). Counts only, no user ids |
| — | Data export | **PASS** | Settings, devices and notification history are in the person's export; endpoints and keys are not (tested) |
| — | Migration 0005 | **PASS** | Dry run on a data copy: upgrade, downgrade, re-upgrade with no drift. The dry run found a downgrade bug (MySQL refused to drop an index a foreign key needed); fixed |

## Acceptance

| Criterion | Evidence |
|---|---|
| Arrives once | Two workers on separate MySQL connections at once: 3 due notifications, 3 sends, 0 duplicates; re-planning creates nothing new |
| At the right local time | Asia/Kolkata 08:00 → 02:30 UTC; New York before/after DST; nonexistent 02:30 and repeated 01:30 each fire once |
| Respects quiet hours | Quiet hours across midnight (21:00–07:00): 06:30 and 22:30 not planned; checked again at send time; milestones wait for quiet hours to end |
| Off in two taps | Browser journey: Me tab → "Notifications on" switch → server shows off; pending jobs cancelled |

## Test counts

| Suite | Before Phase 4 | After |
|---|---|---|
| Backend pytest | 456 | **480 passed** (`test_push.py`: 19 new tests incl. real encryption and the export; export coverage updated) |
| Web vitest | 244 | **257 passed** (39 files; `push-ui.test.tsx` 8, `service-worker.test.ts` 6) |
| TypeScript / ESLint | pass / 0 | **pass / 0 errors** |
| Browser `e2e-p4-push.mjs` (new; push service SIMULATED) | — | **13/13** desktop + 360 px |
| Browser `e2e-p3-camera.mjs` / `e2e-privacy.mjs` / `e2e-studio.mjs` | 10 / 16 / 14 | **pass / 16 / 14** |

## Manual checks: NOT VERIFIED (owner)

Turn the flag on in a test deployment with HTTPS and the tick running every minute, then:

| Device | Steps | Expected | Result |
|---|---|---|---|
| Android phone, Chrome | Routine → Turn on; set "Meal check-in" 2 minutes ahead; lock the phone | One notification at that time; tap opens Nutrition | |
| Desktop browser | Same; then close the browser for 3+ hours with a later reminder set | Arrives when the browser is next running (within the 4 h TTL), once | |
| iPhone, installed from Safari (16.4+) | Add to Home Screen → open → Turn on | Permission prompt inside the installed app; one notification | |
| Any | Set quiet hours around the reminder time | Nothing arrives | |
| Any | Me → switch off | Nothing further arrives | |

## Defects found and fixed during Phase 4

1. The service worker took over immediately on update (`skipWaiting` on install), which could reload the app mid-workout.
2. Migration 0005's generated downgrade failed on MySQL (index needed by a foreign key).
3. The update prompt could stay hidden after a workout ended if the marker flipped on and off between renders.
4. New push tables were missing from the data export (caught by the export coverage test).
5. multidict 7.2.x was under two weeks old; pinned 7.1.0 instead.
