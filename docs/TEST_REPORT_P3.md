# Phase 3 test report: camera exercise tracking reliability

Date: 29 October 2026. Branch `codex/phase-4-camera-tracking`. Windows 11, Node 24.19, Python 3.12, MySQL 8.0, headless
Chrome stable (WebGL GPU delegate available). Browser journeys on the disposable `trackcal_phase3_test` schema.

**Simulated vs real:** no phone and no real person were used. Counting is proven on **synthetic** landmark fixtures.
Browser journeys use Chrome's **fake camera** (a test pattern), which proves permissions, lifecycle, privacy,
performance readout, correction and saving, but **not** counting accuracy. Real-device accuracy is **NOT VERIFIED**
(device matrix below is empty), so all three exercises ship labelled **Experimental**.

## Results by step

| # | Step | Result | Detail |
|---|---|---|---|
| 1 | Inventory | **PASS** | Squat, push-up, bicep curl (no new exercises). MediaPipe Pose lite in a Web Worker, model self-hosted |
| 2 | Exercise config | **PASS** | `lib/pose/exercise-config.ts`: joint triplets, up/down angles, hysteresis, min range, min/max rep time, dwell, visibility, smoothing, camera angle/distance, tips. No thresholds in the logic |
| 3 | Geometry | **PASS** | Landmarks converted to aspect-correct coordinates before angles; 2D side-view angle; the more visible side is tracked and switches if that side is hidden (the rep in progress is discarded) |
| 4 | Smoothing | **PASS** | One-Euro filter on the joint landmarks (so the angle is smoothed too), configurable per exercise; tested on noisy fixtures and a still/moving signal |
| 5 | State machine | **PASS** | SETUP → UP → GOING_DOWN → DOWN → GOING_UP → UP with hysteresis and dwell. Rejection reasons: too shallow ("go a little deeper"), too fast, too slow, lost tracking. Count never decreases (property test) |
| 6 | Visibility gating | **PASS** | Required landmarks below threshold or out of frame → "Counting paused: Step back so your whole body is in frame." Nothing counts while paused (fixture-tested) |
| 7 | Performance | **PASS WITH LIMITATIONS** | 24 fps target; average inference over 15 frames > 60 ms steps down to 15, then 10 fps with a "Low performance mode" indicator; GPU delegate tried first, CPU fallback (also mid-session). No MoveNet fallback (KI-22). Drawing stays on a separate canvas |
| 8 | Lifecycle & privacy | **PASS (SIMULATED)** | Camera only after a tap; stopped on route change, hidden tab, pagehide; plain-language errors for denied / missing / busy camera; rotation restarts only the current movement. Saved data: exercise, counts, per-set duration, confidence, edit flag, timestamps. Server rejects any other field |
| 9 | User correction | **PASS** | Always-visible − / + buttons, "Estimated reps", "You corrected this", confidence shown, manual workout link everywhere |
| 10 | XP & anti-cheat | **PASS** | Unchanged ledger rule: one award per completed session (≥ 1 minute, daily cap), never per rep. Large corrections set `large_edit` for analytics; XP unaffected (tested) |
| 11 | Accessibility | **PASS** | Optional sound/vibration per counted rep (off by default), visible text captions for every instruction, reduced motion respected, 48 px correction buttons, non-camera path for every exercise |
| — | Model caching | **PASS** | Model + runtime moved to a versioned folder (`/pose/mediapipe-1.2.0-lite16-1/`) cached for a year; the build stops if the worker and the folder disagree |

## Fixture results (exact, deterministic)

21 synthetic fixtures (3 exercises × 7 scenarios, 20 fps, gzipped, 269 KB). Expected answers come from how each
fixture was built. All 21 match, for squat, push-up and curl alike:

| Scenario | Reps | Rejections |
|---|---|---|
| Clean set (5 reps, 2 s each) | 5 | none |
| Noisy set (landmark jitter, visibility noise) | 5 | none |
| Half reps (3 full + 3 at 40% depth) | 3 | 3 × too shallow |
| Partial occlusion during one rep's descent | 4 | 1 × lost tracking |
| Walking out of frame after 3 reps | 3 | none; ends paused with the "step back" instruction |
| Very fast reps (0.45 s each) | 0 | 1 × too fast |
| Very slow reps (7 s each, within the 10 s limit) | 2 | none |

Plus: a 14 s rep → too slow; jitter at the top threshold never starts a cycle; stale frames change nothing;
angle unchanged by uniform scaling (500 random cases); count never decreases (5,000 random frames per exercise).

## Test counts

| Suite | Before Phase 3 | After |
|---|---|---|
| Backend pytest | 452 | **456 passed** |
| Web vitest | 201 | **244 passed** (38 files) |
| Standalone `meal-analysis.test.mjs` | 5 | **5 passed** |
| TypeScript / ESLint | pass / 0 | **pass / 0 errors** |
| Browser `e2e-p3-camera.mjs` (new, SIMULATED) | — | **10/10 checks**; 17 of 19 runs passed (KI-24) |
| Browser `e2e-privacy.mjs` (SIMULATED) | 16 | **16/16** |
| Browser `e2e-studio.mjs` | 14 | **14/14** |

The new camera journey covers: denied permission at 360 px (explained, manual path offered, no live track); camera
only after the tap; the local model running (24 fps, GPU) on desktop and 360 px; −/+ correction while tracking;
leaving the page stops every track; no request carries image or landmark data; the saved session contains only the
v2 summary.

## Manual device matrix: NOT VERIFIED (owner)

Target: at least 90% of sets within ±1 rep per exercise. Publish the real number whatever it is. Remove an exercise's
**Experimental** label (`experimental: false` in `exercise-config.ts`) only if it meets the target.

How: 3 phones (low, mid, high end) × 2 lighting conditions (bright, dim indoor) × side view (and front view for
interest) × 10 sets each. Count each set yourself, then compare with the app's *estimated* reps (before any correction).

| Exercise | Phone | Light | View | Sets | Within ±1 rep | Avg fps / processor | Notes |
|---|---|---|---|---|---|---|---|
| Squat | | | side | 10 | / 10 | | |
| Push-up | | | side | 10 | / 10 | | |
| Bicep curl | | | side | 10 | / 10 | | |

## Defects found and fixed

1. Thresholds were hard-coded in the counter; half reps and quick bobbing had no reason the person could act on.
2. The tracked side was chosen once and never changed when that side became hidden.
3. No smoothing: jitter near a threshold could flip phases (now hysteresis + dwell + One-Euro).
4. Fixed 10 fps with a single 180 ms slow-down rule; CPU only. Now a 60 ms budget with steps and GPU-first.
5. Camera errors showed the browser's raw message (e.g. "Denied"); now plain words for denied, missing, busy and
   unavailable cameras.
6. The pose model (5.8 MB) and runtime were served `no-cache`, so every visit re-validated them.

## Not done (recorded)

- MoveNet low-end fallback (KI-22). Real-person fixtures (KI-23). Real-device accuracy (KI-21).
