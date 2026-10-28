# Full verification — 26 October 2026

This report distinguishes automated coverage, live service evidence, browser interactions and external prerequisites. It does not claim that every possible device, failure mode or advertised third-party capability has been tested.

## Automated regression

- Backend: **153 passed** in rollback-only MySQL transactions.
- Web: **140 passed** across 23 files.
- Standalone nutrition-parser checks: **4 passed**.
- Total: **297 automated checks passed**. Lint passed after the updated live scripts. Application source was unchanged during this pass; the existing production build was exercised rather than rebuilt unnecessarily.

## Live results

| Workflow | Result / evidence |
| --- | --- |
| Signup, cookies, session/profile, logout, wrong-password rejection, login, refresh | Passed through actual Next/FastAPI/MySQL using disposable QA account |
| Cloud snapshot save/read | Passed; real stale-revision conflict rejected with 409 |
| Coach availability/reservation | Passed, including exactly one successful booking in a simultaneous two-member race |
| Coach reschedule/cancel/slot release | Passed; disposable coaching accounts deactivated |
| Web AI text | Passed using real OpenRouter response, is_mock=false |
| Web AI image | Passed on generated synthetic label: 200 kcal, 12 g protein, 20 g carbohydrate, 8 g fat; this is not a food-photo accuracy benchmark |
| Anonymous AI | Correctly rejected with 401 after authenticated mode was enabled |
| Cross-origin and malformed AI requests | Correctly rejected |
| Backend AI scan-job workflow | Passed separately using real provider and rollback-only transaction |
| Open Food Facts barcode | Passed for a public test barcode |
| USDA food search | HTTP 200, 12 results for egg |
| Ingredient parser | Real parser passed; ambiguous cup weights remain explicitly unknown |
| Constrained planner | Real OR-Tools optimizer returned the expected feasible plan |
| Shopping/pantry subtraction | Passed with synthetic stock/requirements |
| Recipe URL import | Real public Allrecipes page extracted 11 ingredient lines |
| Voice transcription | Real local Whisper fixture transcription passed |
| Label OCR | Real local PaddleOCR fixture recognition passed after runtime repair |
| Food prices | Open Prices returned 20 observations |
| Exercise search | wger returned six matches with license metadata |
| Grocy private access | Unbound QA account correctly denied with 403; owner-connected household workflow remains unverified |
| Mealie | Returned 503 for unavailable configuration; this service is not operational end to end |
| Main pages/assets | 17 page/static routes returned HTTP 200, including offline HTML, manifest and CSV template; HTTP success alone does not certify every interaction |

## Browser interactions

REA controlled scenarios used temporary profiles, synthetic data, reduced motion and explicit actions. All owned browser processes were terminated; no real user's browser storage was modified.

- Mobile journal: add meal, edit 123 to 150 kcal, save correction and repeat. Browser showed two meals and 300 kcal. No page errors. Evidence: `ev_861f308d36a3ae04b02d7895284d6f07c226b444868dedce652b9ae95f5e70d7`. Screenshot: journal-live-verification.png.
- Reminder: fill title/date, save, edit, cancel edit and trigger calendar export. All actions completed. Evidence: `ev_ebf0f115f1bc19eb08ae8e252fedd4091f732f56a64d0be75a8959f93b6587d5`. REA recorded the expected `trackcal-calendar.ics` download initiation and cancelled the download in its controlled capture; do not describe this as a completed external-calendar import. Calendar contents are covered by unit tests.
- Invalid login: actual API rejection displayed as an accessible alert, and submit returned to its usable state. No page errors. Evidence: `ev_22bc21e0d8eedb6a95c7ecf04d64031c949c0bdea9dc53aee9579a20a093c5e2`.
- CSV import/export, indexed storage, onboarding, reminder persistence, offline fallback, device recording cleanup and permission errors have automated coverage. Not every one was exercised through a fresh physical-device/browser flow today.

## Failures found and corrected

1. Local AI was disabled by the production-default guard. Set ENABLE_AUTHENTICATED_AI=true in the ignored local web environment and restarted the verified web service. Anonymous access remains blocked; no account verification or production protections were removed.
2. OCR worker was stopped, then model import failed because Windows Application Control blocked chardet's optional compiled extension. Installed the official pure-Python wheel of the same chardet 7.7.0 release, preserving Windows protections. Compared its SHA-256 with official PyPI metadata and pinned that wheel for Windows in requirements-ocr.txt. OCR model initialization, live label extraction, pip check and requirements dry-run now pass. Source: https://pypi.org/project/chardet/7.7.0/.
3. Older live AI test assumed anonymous inference. Updated it to create a disposable account, assert anonymous rejection, use session cookies, bound requests and deactivate its account in finally. Added a separate opt-in recipe/household-access live test.
4. Long-running services ended during a tool reconnection. Restarted the web, API and OCR as hidden local processes with logs in ignored backend/runtime. API remains a local non-production testing environment; this does not constitute public deployment.

Synthetic account cleanup passed; a database count confirmed zero active disposable AI test accounts. No real account permissions, passwords or private household bindings were changed.

## Still blocked or outside verified scope

- Real SMTP delivery and production HTTPS/domain/monitoring: deferred operator configuration.
- Payment processing, invoices/refunds and payment-provider reconciliation: unconnected, not advertised as available.
- Grocy owner binding and Mealie deployment: unfinished. Access denials are not proof that household data imports work.
- External calendar synchronization, delivery of imported calendar alerts and closed-browser push: not connected or not verified.
- Docker engine/image tests, complete uploaded-file/database restore and load/rollback drills: not performed; Docker engine remains unavailable.
- Physical iOS/Android camera/microphone, native health sync and separate Expo prototype: unverified.
- Independent security review, nutrition accuracy, customer retention and economics: require external evidence.

## Repeatable commands

From frontend/web: `npm test`, `npm run lint`, `node --test tests/meal-analysis.test.mjs`.

Live opt-ins (loopback services must be running): RUN_LIVE_ACCOUNTS=true for tests/live-account-smoke.mjs; RUN_LIVE_INTEGRATIONS=true and TEST_PUBLIC_APIS=true for tests/live-integrations.mjs; RUN_LIVE_AI=true and RUN_LIVE_BARCODE=true for tests/live-smoke.mjs; RUN_LIVE_RECIPE=true for tests/live-recipe-smoke.mjs.

From backend: `.venv/Scripts/python.exe -m pytest tests -q`; RUN_LIVE_COACHING=true for scripts/live_coaching_smoke.py; RUN_LIVE_AI=true for tests/live_smoke.py. Use the appropriate environment-variable syntax for the host shell. Live AI sends only synthetic fixture data to the configured provider and consumes its quota.
