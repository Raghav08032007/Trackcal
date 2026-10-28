# Repetition estimate engine

28 October 2026. Deterministic heuristics over 2D projected landmarks; counts are estimates with manual review, not exercise-quality/medical-safety judgments.

## Modular analysis

`LandmarkNormalizer` functions validate 33 finite points and one person, preserve aspect ratio, and calculate joint angles. `ConfidenceEvaluator` functions require relevant points inside the frame and minimum visibility/presence .65. JointAnalyzer fixes the better visible side for a set and rejects abrupt hip-center view movement (> .18 normalized-height distance), darkness when available, cropped/low-confidence points and degenerate angles. A side change needs a new set/reset; no cross-arm counting mid-cycle.

| Analyzer | Measurement | Extended / bent threshold | Boundary |
|---|---|---|---|
| SquatAnalyzer | Hip–knee–ankle angle | ≥155° / ≤95° | Familiar side-on squat, required landmarks visible |
| PushUpAnalyzer | Shoulder–elbow–wrist angle | ≥155° / ≤95° | Side-on floor variation; shoulder–ankle projection substantially horizontal |
| BicepCurlAnalyzer | Shoulder–elbow–wrist angle | ≥150° / ≤65° | One arm per set; upright torso and limited projected upper-arm drift |

Thresholds are provisional engineering heuristics. They are not prescriptions to force range, calibrated anatomy/3D measurements or professionally validated form cues. Perspective, occlusion, clothing, mobility differences and tracking failures can miss/overcount movement. Use manual logging when the comfortable variation is not recognized.

## State machine

Starting → stable extended position → ready → stable bent position → return → stable extended position → increment once. A candidate phase needs at least three distinct frames spanning 150 ms. Bend requires 250 ms since ready, return 250 ms since bend, full cycle at least 700 ms. Intermediate angles provide hysteresis. Repeated/stale timestamps never count; gaps >750 ms, low-confidence/invalid frames and pause reset phase progression. Continuous extended/bent frames never multiply reps. Count bounded to 100 per set, at most 20 sets; limits are storage bounds, not goals.

SessionTracker owns analyzer/counter, pause state and aggregate sampled-frame/low-confidence/mean-confidence statistics. Reset removes the current set only; finishing a set retains its summary and allows rest. No rewards are computed here. Manual correction keeps `estimated_reps` and sets nullable `corrected_reps`; server final counts determine corrections while preserving original estimates on history amendments. Manual history cannot relabel itself as camera evidence.

## Accuracy methodology

Executed deterministic fixtures cover all three start/bend/return paths, repeated frames, confidence loss, partial views, camera jumps, darkness, pause/gaps and reset. Browser fixtures exercise the same application analyzer. Real MediaPipe inference on one public static person image verifies 33 landmarks, not rep accuracy.

Before accuracy claims: consented diverse participants/devices, expert-labeled full movements and non-reps, multiple comfortable variations/camera angles/light/clothing/occlusions; separate development/test sets; report false/missed counts, exact-session error/MAE, confidence rejection and user-correction rates per exercise/device/subgroup. Measure frame latency, UI responsiveness, memory, battery and thermal behavior over representative sessions. No measured rep-accuracy percentage or reviewed technique assessment is currently claimed.
