# Phase 4 audit and baseline — 28 October 2026

Dedicated branches: `codex/phase-4-camera-tracking` in root and embedded frontend; pre-existing changes retained. Read Phase 0 UI/audit materials, Phase 1 gamification/companion rules, Phase 2 implementation and Phase 3 implementation, workout/scanner architecture and regression handoff. Inspected actual training router, strict inputs, MySQL session JSON model, barcode camera, account-scoped storage, companion and centralized reward engine. No missing critical Phase 0–3 prerequisite found.

Baseline: **259 backend tests / 191 frontend tests passed**. First backend invocation passed 256 and hit three Windows temporary-directory permission setup errors; rerunning with a project-local writable `--basetemp` passed all 259. An initial command run from the root rather than backend failed import discovery; corrected cwd before baseline. No application assertion removed or skipped.

Stack remains Next 16 / React 19 / TypeScript, FastAPI / SQLAlchemy / MySQL. Existing `workout_sessions.details` JSON holds sets, notes and versioned camera summaries; no duplicate records/tables. Existing owner scope, revision locking, UUID retries, plan linkage and daily reward cap retained. New camera route extends the app. Existing scanner remains separate.

Selected pinned `@mediapipe/tasks-vision@1.2.0`, local Lite float16 model v1, CPU/WASM dedicated worker. Google documents synchronous detection and worker use: [official guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js). Model/runtime assets self-hosted. No paid inference provider. Hardware acceleration is not required. Initial model download/preparation requires network; runtime model fetch is same-origin. Browser capability, hardware, clinical validation and physical device acceptance are separate evidence gates.

Phase 4 introduces manual opt-in camera exercise choices; existing automatic personal-plan recommendations do not start prescribing camera exercises. Explicit eligible substitutions can link today's matching activity. No Phase 5 work is included.
