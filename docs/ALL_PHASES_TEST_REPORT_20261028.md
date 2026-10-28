# TrackCal cross-phase verification — 28 October 2026

Scope: all **implemented Phases 0–4**, on branch `codex/phase-4-camera-tracking`. Phases 5–6 are not implemented and were not treated as passing tests. No application source changes were required by this run.

## Results

| Check | Result |
|---|---|
| Complete backend pytest suite | **274 passed**, 0 failed; 1,798 existing deprecation warnings |
| Complete frontend Vitest suite | **211 passed**, 37 files, 0 failed |
| Separate Node meal-analysis suite outside Vitest's file patterns | **4 passed**, 0 failed |
| Total automated unit/integration tests | **489 passed** |
| Phase 2 real-app browser journey | **7 checks passed** |
| Phase 3 real-app browser journey | **17 checks passed** |
| Phase 4 real-app browser journey | **18 checks passed** |
| Total browser acceptance checks | **42 passed**, no page errors reported |
| Production build + TypeScript + pose asset checksum preparation | **Passed**, 28 pages |
| Complete frontend ESLint | **0 errors, 5 warnings** |
| Real local MediaPipe model | **Passed**: blank image produces no person; official public person image produces one person / 33 landmarks |
| Real authenticated OpenRouter text → scan job → retrieval | **Passed**, provider=openrouter, is_mock=false; synthetic food text only, HTTP 200 |

The five lint warnings concern a camera cleanup ref heuristic, companion effect dependency, nutrition image/import and an old unused test import. They were not hidden or counted as errors. Node also reports a module-type inference warning in the standalone TypeScript test imports. The separately discovered Node suite must continue to be run explicitly (`node --test tests/meal-analysis.test.mjs`) alongside Vitest; it is not included in Vitest's 211 count.

## Phase coverage

| Phase | Verified in this run |
|---|---|
| 0 — audit/UI foundation and existing product | Build, routes, authentication/account workflows, APIs, private exports, offline storage, responsive layout, depth feedback, scanner/provider parsing and existing integration contract tests |
| 1 — engagement/companion | Server-owned XP, daily/global caps, idempotent rewards, levels/unlocks, achievements, streak/rest behavior, companion preferences, animation suppression and real browser achievement reaction |
| 2 — personalization | Onboarding, profiles/measurements, owned plan substitution, personalized activity rules, reminder preferences, keyboard/native control navigation and actual youth-calculator safeguard |
| 3 — nutrition/workouts | Cloud diary/search/portion corrections, local photo review, reusable meals/favorites, persistent manual workouts/sets/pause/resume/history, exports, plan linkage and duplicate XP prevention |
| 4 — camera | Deterministic squat/push-up/curl analyzers, confidence rejection/state machines, permission/resource cleanup, user corrections, confirmed history, plan/central reward integration, compact live mobile controls and real local pose-model inference |

## Test isolation and commands

Backend: `APP_ENV=testing DB_NAME=trackcal_phase3_test`, `python -m pytest tests -q --basetemp runtime/all-phases-20261028 --disable-warnings` from backend. Existing per-test rollback-only transaction fixture retained. Browser services used only loopback ports **3003 → 8003**, configured for that dedicated test schema and mock AI for browser fixtures. Synthetic accounts and explicit test catalog rows only; customer sessions/private records were not used.

Frontend: `vitest run --maxWorkers=2`; `node --test tests/meal-analysis.test.mjs`; `npm run build -- --webpack`; `eslint .`. Original assertions were retained. The build's model-preparation step verified the pinned model hash. Existing `tests/e2e-phase2.mjs`, `e2e-phase3.mjs` and `e2e-phase4.mjs` ran using the existing Playwright/installed Chromium runtime. Phase 2's optional test-URL/fixture arguments pointed it at an explicitly seeded isolated synthetic account.

Live text inference reused the existing opt-in `backend/tests/live_smoke.py` with RUN_LIVE_AI=true, the configured provider and an isolated rollback-only synthetic account. Submitted text was “One boiled egg and a slice of whole wheat toast”. No customer photo/video, secret or measurement was sent. The live scan and retrieval succeeded; this establishes one provider workflow, **not nutrition accuracy**. The first stdin wrapper hit dotenv's stack-discovery assertion before any request; explicit `.env` path corrected the harness, then the actual live test passed. No application test was removed to resolve that setup issue.

## Evidence and limits

- Browser evidence: [Phase 2](phase2-bounded-browser-evidence.json), [Phase 3](phase3-browser-evidence.json), [Phase 4](phase4-browser-evidence.json). Screenshots/AX artifacts were refreshed using synthetic account content.
- Current real-model probes: [blank](all-phases-model-blank-20261028.json), [public person](all-phases-model-person-20261028.json). Model-ready 628/635 ms; these are desktop headless CPU/WASM observations on static inputs. Prior Phase 4 timing artifacts were preserved separately.
- Actual camera streams and pose inputs in browser acceptance were **synthetic**, including denied-permission and low-confidence scenarios. Actual model inference used the local real runtime and official public static image; no physical exercise was performed for the tests.

**NOT VERIFIED:** real-camera rep accuracy across people/variations/light/clothing; physical phones, Safari/Firefox/OS permission/interruption matrix; physical-device battery/heat/long-session performance; independent screen-reader/user accessibility validation; production load/security/operations, SMTP delivery, billing/payment activation, and live private Grocy/Mealie/other external-provider functionality. Their existing automated contracts/mocked failure paths are covered where tests exist, but that does not certify live deployments. Existing [71-entry limitations register](LIMITATIONS_REGISTER.md) remains open; passing this run does not resolve those release gates or establish a 10/10 public launch.

## Handoff

All executed application tests passed. No new critical application defect was found by this run. Synthetic accounts are removed only from their explicitly recorded test ledgers; temporary fixture credentials are deleted and isolated services stopped. The usual app is restored at `http://127.0.0.1:3002`. No deployment, payment activation, commit/push or Phase 5 work is included.
