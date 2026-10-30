# Visual pass and Phase 9 test report: photos, compact UI, verified events

Date: 30 October 2026. Branch `codex/phase-4-camera-tracking`. Windows 11, Node 24.19, Python 3.12, MySQL 8.0, headless
Chrome. Browser journeys on the disposable `trackcal_phase3_test` schema.

**Simulated vs real:** no phone was used. The QR flow was tested by having the guest open the exact link the QR code
encodes (read from the same endpoint); the QR image was not scanned by a camera. Scanning with real phones is
**NOT VERIFIED**. Events ship **off** (`verified_events` flag).

## Part 1: visual pass

| Item | Result | Detail |
|---|---|---|
| Photos | **PASS** | 9 free-licence photos from Wikimedia Commons (CC0, CC BY, CC BY-SA), not Google Images (copyright). Self-hosted WebP at 640 and 1200 px, 1.2 MB total. `/credits` lists author, licence and source for each; linked from the footer |
| Where they appear | — | Home "Ideas for today" carousel (6 cards), Nutrition hero (thali), Workouts hero (yoga), Credits page |
| Smaller text | **PASS** | Base 16 px (15 px on phones, was 18/17), compact headings (page titles 26–38 px, was 36–66 px). Buttons still at least 44 px tall |
| Interactive, movable | **PASS** | Carousel: swipe, mouse-drag, arrows, snap. Cards tilt in 3D with the pointer (posts, communities, plans, destinations, photos). Below-the-fold cards fade up once. Floating companion can be dragged anywhere and remembers its spot (double-click resets); a tap still opens it. All motion off with reduced motion |
| Accessibility | **PASS** | axe WCAG 2.2 AA clean on all journeys. Muted text darkened (about 6.4:1) because smaller text needs more contrast headroom |
| Bugs found | fixed | Browser image-drag cancelled the companion drag (moved 50 px of 500); the companion covered the footer's "Send feedback" button on phones |

## Part 2: verified events (Phase 9)

| Area | Result | Detail |
|---|---|---|
| Create | **PASS** | Anyone with a feed profile; 10 upcoming max; 10 minutes to 180 days ahead; 15 min to 12 h; time entered in the organizer's time zone, stored in UTC, shown in the event's zone. Community events only by its owner or moderators; private-community events members only |
| Sign up | **PASS** | Going up to capacity, then waitlist; a cancellation promotes the oldest waitlisted person; the organizer doesn't take a seat |
| QR check-in | **PASS** | Organizer's screen shows a QR code from 30 minutes before the start to the end, refreshed every 30 s. Token = HMAC(event secret, 30 s window), current or previous window accepted. Expired, forged, not-registered, waitlisted and organizer self check-in all refused |
| Organizer check-in | **PASS** | By handle, for registered people only |
| XP | **PASS** | `verified_event_attendance` (50 XP) pays once per event through the ledger; "Verified Event" badge unlocks. Still impossible to claim from the client |
| Privacy | **PASS** | Attendee list for the organizer only; others see counts. No location tracking. Export includes events and sign-ups, never the QR secret |
| Migration 0010 | **PASS** | Dry run clean; enables the event rule and badge, downgrade disables them again |

## Test counts

| Suite | Before | After |
|---|---|---|
| Backend pytest | 573 | **593 passed** (`test_events.py` 12) |
| Web vitest | 278 | **284 passed** (`events.test.tsx` 6) |
| TypeScript / ESLint | pass / 0 | **pass / 0 errors** |
| Browser `e2e-p9-events.mjs` (new) | — | **13/13** desktop + 360 px, CSP clean, axe clean |
| Other browser journeys (11) | pass | **all pass**; hardening passes 8 of the last 9 runs (KI-43) |

## Dependencies

`qrcode-generator` 2.0.4 (MIT, no dependencies, released over a year ago). Chosen over `qrcode`, which pulls in
yargs and pngjs.

## Owner checks (NOT VERIFIED)

- Scan the organizer's QR code with an Android camera and an iPhone camera; both should open the check-in page.
- Brightness: phones scanning a laptop or phone screen in daylight.
- Before turning events on: event reporting (KI-44), and a decision on the 60-second QR window (KI-45).
