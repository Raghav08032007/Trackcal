# Phase 4 — private camera exercise tracking

28 October 2026. Branch `codex/phase-4-camera-tracking` in both existing checkouts. Extends the existing product; Phase 5 is not started or authorized by this handoff. See [audit](PHASE_4_AUDIT.md) and [test report](PHASE_TEST_REPORT.md) for exact execution status.

## Delivered

- `/workouts/camera`: authenticated, explicitly enabled camera, local preview, one-person skeleton overlay, squat/push-up/single-arm curl selector, rep/set counters, active time, visibility confidence and tracking state. Compact mobile live-view metrics/pause/review controls; pause, resume, immediate shutdown, current-set reset, rest/set boundary, end/review, manual correction, camera selection/front–rear preference, optional feedback/overlay and manual-workout fallback.
- Separate typed analyzers, aspect-ratio normalization, conservative visibility/movement checks and a hysteresis/stability rep state machine. No medically specific form instruction or safety certification.
- Pinned MediaPipe Lite inference in a dedicated **classic Web Worker**. Actual Chromium testing found module-worker loading incompatible with this runtime's classic WASM loader. Model and WASM are self-hosted, loaded after explicit camera access, CPU delegate, no paid/cloud vision API.
- Confirmed summaries use existing UUID/revision-protected `/wellness/sessions` APIs and existing `workout_sessions` rows. Original detected estimates, user corrections and manual sessions remain distinct. Aggregate metadata only; no raw video, images or retained landmarks.
- Explicit eligible camera substitutions in My plan can link today's matching activity; completion updates that activity transactionally and shares its reward source ID. Automatic recommendations still exclude camera-only templates. Restrictions, pain feedback, rest-day and equipment gates remain.
- Existing centralized workout reward, existing daily/global caps, replay protection. New participation achievements: First Camera Workout, Movement Explorer (three exercise types), Tracking Milestone (three distinct local days). No XP increase for confidence, count, load or duration. These are user-confirmed participation badges, not verified athletic skill.
- Existing shared companion displays setup/tracking/low-visibility/saved guidance and actual achievement reactions. A portal places the same companion in reserved page space outside the camera preview and controls. Mute/minimize/disable/dock side and calm/OS motion preferences remain. No microphone or sound.

## Changed files

Frontend: new camera route/component; `lib/pose/{types,landmarks,analyzers,squat,pushup,curl,rep-counter,session-tracker,feedback,detection-service}`; `public/pose-worker.js`; reproducible `scripts/prepare-pose.mjs`; package/lockfile, vendor lint ignore; existing workout history/types, companion, layout, shared CSS, privacy notice and account-scoped draft validation/export handling. New deterministic engine/service/UI fixtures/tests, opt-in browser journey and real-model probe.

Backend: existing training router and strict wellness inputs; curated template eligibility and explicit substitution exposure; centralized gamification metrics/definitions. New `scripts/migrate_camera.py`, reference migration `20261028_04_camera.sql` and `tests/test_camera.py`. No replacement stack, new upload endpoint, duplicate workout model or separate XP system.

## Migration and assets

Run `backend/scripts/migrate_camera.py` in a quiet release window. Version 20261028_04 seeds missing central achievement definitions without overwriting configuration and verifies existing user/session/meal/reward/plan counts. Camera snapshot version 1 lives in existing JSON, so no new columns/tables or historical rewrite is needed. Absent `tracking_method` on old rows means manual. Preserve additive metadata if rolling back; do not drop history. Existing account export includes these session details through the Phase 3 export path.

`npm run prepare:pose` (also predev/prebuild) copies pinned runtime assets and downloads the public Lite model only if absent. The model SHA-256 is pinned and checked before use. See [manifest](phase4-model-manifest.json), [Apache license](third_party/mediapipe-LICENSE) and THIRD_PARTY_NOTICES.md. Generated public/pose assets are ignored and must be prepared before direct `next` commands or packaging. Runtime downloads are same-origin. A first deployment/build needs asset-download access and adequate disk/browser memory; hosting is not cost-free.

## Limits and readiness

Real model startup and body landmark inference on an official static public image are separate from synthetic rep-count/browser tests. They do not establish physical-camera accuracy, all-body/angle coverage, iOS/Android/Safari/Firefox support, long-session thermal behavior or independent accessibility certification. Those statuses remain **NOT VERIFIED**. No training dataset, learned form score, body ranking, recording, voice coach or clinical diagnosis is included. Full limitations and closure conditions remain in LIMITATIONS_REGISTER.md. Await approval before Phase 5.
