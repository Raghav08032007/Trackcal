# Step 4 (part 1): navigation, alignment and live feature checks — 29 October 2026

## Owner decision: navigation

On 29 October 2026 the owner chose a **bottom tab bar** (Home, Food, Move, Play, Me). This replaces the earlier "no navigation bar" direction recorded in `UX_HOME_REORGANIZATION_20261028.md`.

- **Phones:** a fixed bottom bar with 44 px+ targets, safe-area padding, and the current tab marked (`aria-current="page"`).
- **From 860 px:** the same five tabs as a sticky top bar.
- **Slim page header:** brand link, "Ask Pip", and the current section's pages as a scrollable row. Food has 7 pages, Move 3, Play 2, Me 8, so every destination is within two taps.
- **Sign-in screens and the offline journal** have no navigation. Home keeps its own header.
- **The footer** went from 13 links to Appearance, Reduce motion, Guided test drive, Help, Privacy and Terms.
- **Bottom-docked elements** (toasts, the floating companion and its re-enable button, the onboarding companion) are lifted above the tab bar.

Code: `src/components/app-navigation.tsx`, `src/app/navigation.css`. The old `studio-navigation.tsx` was removed.

## Alignment fixes

| Problem | Fix |
|---|---|
| Nutrition, Workouts, Camera and Play each had their own header and link row duplicating navigation | Removed; Play keeps its Calm mode control |
| The food workspace's internal switcher was labelled "Main navigation" | Renamed "Food workspace sections" |
| Home header buttons wrapped to a second row; "Pause motion" took a full row on phones | One-row header; compact 44 px buttons (`src/app/layout.css`) |
| Signed-out cards ran "Sign in →" and the alternative together as plain text (4 pages) | A primary "Sign in" button and a secondary button, full width on phones |
| `/routine` scrolled sideways at 360 px | See the frontend migration report |

## Live feature checks (real services)

| Feature | Result |
|---|---|
| Barcode lookup (Open Food Facts) | **PASS**: 3017620422003 → Nutella, 539 kcal/100 g |
| Food search (USDA FoodData Central) | **PASS**: "banana" → 12 complete results |
| AI meal estimate (OpenRouter) | **FAILED, then FIXED.** `OPENROUTER_MODEL=openrouter/free` lets OpenRouter pick any free model; it picked a content-safety classifier that replied "User Safety: safe", so every estimate failed (correctly, without inventing food). Now the API sends two named free vision models in fallback order (`google/gemma-4-31b-it:free`, `nvidia/nemotron-3.5-super-vl:free`); `OPENROUTER_MODEL` accepts one model or a comma-separated list. Rerun: "2 idli with coconut chutney and a cup of sambar" → 3 items, 315 kcal, in 20.8 s via the fallback model |

Not verified: a real meal **photo** through the live model (the stubbed tests cover the photo path); estimate accuracy (Phase 2); and latency. About 20 s is slow, and the scanner already shows progress while it waits.

## Verification

358/358 backend, 168/168 web, TypeScript, lint 0 errors / 2 accepted warnings. In Chromium: studio 14/14 (now expecting exactly one main navigation), all 27 routes and the 404 page clean at 360 px, and privacy 16/16.

## Part 2: feature journeys in a real browser (29 October 2026)

All journeys ran on the Vite + Flask stack against the isolated `trackcal_phase3_test` schema (your app data was not used).

| Journey suite | Result | Covers |
|---|---|---|
| `tests/e2e-phase2.mjs` | **7/7** | Login, plan activity substitution persisted, accessible plan names, keyboard navigation, reduced motion, youth-calculator bypass rejected |
| `tests/e2e-phase3.mjs` | **17/17** | Signup, food search, local photo preview (no upload), scanner confirmation with XP and companion reaction, diary correction, saved meal and favorite, workout sessions and sets, duplicate-completion zero XP, badges and levels, mobile/tablet/desktop layouts |
| `tests/e2e-phase4.mjs` | **18/18** (SIMULATED camera) | Camera permission flow, rep counting for squat/push-up/curl, pause/resume, corrections, saved history, denied permission fallback, same-app navigation releases the camera |
| `tests/e2e-journeys.mjs` (new) | **23/23** at 360 px and desktop | Play start persists; barcode, describe, food library and recipe logging; journal; reminder saved and exported as `.ics`; profile change persists; account export; password change then sign-in with the new password; account closure blocks the session |
| Studio, privacy, all-route crawl | **14/14, 16/16, 28/28** | |

Public providers are stubbed inside `e2e-journeys.mjs` for determinism; they were verified live in part 1.

### Defects found by the journeys and fixed

| Defect | Severity | Fix |
|---|---|---|
| **The camera stayed on after tapping a link away from the camera page** until the next page's code had loaded (React Router keeps the old page during loading) | Sev-1 privacy | The camera page stops all tracks on any same-site link click and on Back/Forward, before navigation starts |
| **The Vite app loaded fonts from Google Fonts**, sending every visitor's IP address to Google (Next.js had self-hosted them) | Sev-1 privacy | Geist is bundled with the app (`@fontsource-variable/geist` 5.3.0, OFL-1.1); no third-party font requests |
| Each page asked the server for the XP summary up to three times; the summary takes row locks, so the requests queued and delayed other account actions (Phase 1 limitation P1-05) | Sev-2 | One shared request, reused for 1.5 s; any XP change or account switch clears it; tests reset it between cases |
| The phase 4 script still used the removed "Workout history" header link | Test | Uses the Move section navigation |
| Evidence files carried a hard-coded date | Test | Use the run date |

### Not covered by a browser journey

- **Coach booking:** needs an approved professional account; covered by API tests (`tests/test_coaching.py`).
- **Smart tools** (pantry, shopping, recipe import, label OCR, local speech): they need the optional Grocy, Mealie, OCR and Whisper services, which were not running; covered by API tests with recorded fixtures.
- **Real phones and real photos:** see the manual test list in the reports.

### Timing note

During this run the computer was heavily loaded by other applications (CPU 66%; a plain Python loop ran about 20× slower than normal). bcrypt password hashing took 2–5 s and one password change took 56 s while SQL echo logging (`APP_ENV=development`) was on. Timings in this session are not representative; Phase 6 includes a proper load test.
