# TrackCal feature verification — 2026-10-21

## Result

110 web regression tests, 119 backend tests, and 4 standalone nutrition-parser tests pass (233 automated checks). The Next.js production build and ESLint pass without errors or warnings. TypeScript checks the app and its test sources during the build. Web tests use one worker and a 20-second per-test timeout to avoid contention on this Windows workspace.

Account additions: real signup/login, HttpOnly cookies, session refresh, profile and password updates, owner-isolated cloud backup/restore, per-account local storage, progress charts and printable reports. An opt-in live account smoke test also passed against the running Next and FastAPI servers; it deactivated its synthetic account afterward. See [CALAI_FEATURE_COMPARISON.md](CALAI_FEATURE_COMPARISON.md) for REA evidence and remaining integration gaps.

This report covers the active web application and backend API. It is not certification of the separate Expo mobile prototype or of model nutrition accuracy.

## Feature coverage

| Feature | Verification | Result / boundary |
| --- | --- | --- |
| Navigation, six tools and responsive layout | Component tests and browser smoke checks | Pass; goals remain accessible on narrow screens |
| Photo upload | Actual FileReader bytes in component tests; valid label image sent to live AI route | Pass; invalid type, empty/oversized uploads and failed estimates have visible errors |
| Portions and cooking styles | All five styles, gram scaling, save-to-journal regression tests | Pass; component amounts, macro percentages and totals now update together. Cooking adjustments remain heuristic estimates |
| Barcode typing, lookup and logging | Mocked route edge cases; live OFF request; browser lookup and 15g product logging | Pass; failed lookup cannot save stale product; all nutrients use the same portion factor |
| Barcode camera | Mocked decoding, denied permission and cleanup tests | Pass under simulated device responses. Physical camera scanning remains unverified |
| Meal descriptions | Live web route, component parse/save/error tests and authenticated backend live scan | Pass; no silent invented nutrition. JSON mode and one bounded retry handle invalid free-model output |
| Voice input | Simulated recognition, unsupported browser, permission failure and abort-on-unmount tests | Pass under simulation. Real microphone and browser speech service remain unverified |
| Food library | Local name/cuisine/allergen filtering, empty state, live USDA search and remote-food logging tests | Pass; offline starter foods remain available. Global results are per 100g; brands are retained; missing macro records are excluded |
| Recipe studio | Add/remove ingredients, invalid data, serving bounds, local persistence and serving-to-journal tests | Pass; nutrition is entered explicitly rather than fabricated |
| Journal | Add/edit/repeat/delete, refresh persistence, summaries and independent calendar dates | Pass; test meal removed after browser verification |
| Water, steps, weight and activity | Persisted dated values and water undo in component tests | Pass; these are manual records, not native health sync |
| Goals | Loss/maintenance/muscle gain math, invalid input, persistence, focus and Escape tests | Pass; muscle gain adds the intended 300 kcal |
| JSON export | Inspect generated Blob contents; all dates, meals and wellness included; unrelated browser keys excluded | Pass; backend export now contains actual meal items and nutrients too |
| Storage failures and midnight | Corrupted JSON, wrong-shaped data, full storage, session-copy export, cross-tab update and midnight tests | Pass; damaged data does not crash the app and is not overwritten by merely reading it |
| Browser request origin | Genuine 127.0.0.1 browser requests and internal-localhost regression test | Pass; foreign origins still rejected |
| AI route errors and concurrency | Missing config, production default, malformed JSON, invalid model output, provider 401/429/503, two-request limit | Pass; provider error details/credentials are not returned to the client |
| Authentication and private APIs | Signup/login/refresh, failed login, access-vs-refresh token, every private-route guard, account isolation and soft deletion | Pass against real MySQL in rollback-only transactions |
| Backend nutrition workflows | Meal create/read/copy/confirm/delete; exact seven-day summary; water and recipe calculations | Pass |
| Backend support/community/subscriptions | Ticket CRUD reads, submissions, plans/status/history and invalid free-plan cancellation | Pass; billing plans remain illustrative, with no payment processor integration |
| Backend scan workflow | Valid/invalid image, scan job, correction, daily quota and no-provider behavior | Pass; deterministic suite explicitly enables labeled mocks; the separate live test uses real OpenRouter |

## Important fixes

- Corrected a real-browser origin rejection hidden by direct HTTP tests.
- Added speech input, direct recipe logging, live food search and user-visible save notifications.
- Fixed muscle-gain goal mapping, recipe serving limits, stale barcode saving, missing allergen filtering and fixed photo component/macro displays.
- Removed silent sample inference from the production backend path; mock mode requires an explicit flag and reports its provider accurately.
- Validated image content and nutrition ranges, rejected unknown cooking styles and protected private custom recipe ingredients.
- Fixed an unbounded weekly range and incomplete backend export.

## Live services and data isolation

OpenRouter text and synthetic-label vision requests, Open Food Facts product lookup, and USDA search returned real responses. The backend authenticated text-to-scan-job workflow also passed with `provider=openrouter` and `is_mock=false`.

Automated backend writes use an outer transaction with nested savepoints; all writes are rolled back. The live backend smoke test uses the same isolation. A subsequent database check found zero QA users matching the test email domain. Photo-test files use temporary directories. The browser barcode test entry was deleted through the UI.

The supplied OpenRouter key is held in ignored server environment files for the web and backend. It is not embedded into application code or test fixtures.

## Reproduce

```powershell
# Web: F:\track cal\frontend\web
npm test
npm run build
npm run lint
node --experimental-strip-types --test tests/meal-analysis.test.mjs
# Requires running local dev server and external services:
$env:RUN_LIVE_AI='true'
$env:RUN_LIVE_BARCODE='true'
node tests/live-smoke.mjs

# Backend: F:\track cal\backend
.\.venv\Scripts\python.exe -m pytest tests -q --disable-warnings
# Explicit opt-in to real inference; writes are rolled back:
$env:RUN_LIVE_AI='true'
.\.venv\Scripts\python.exe tests/live_smoke.py
```

## Limits

- The Expo app is a separate prototype and was not run on an emulator or phone. Native Apple Health/Google Fit sync, cloud recovery, reminders and payment processing are not implemented by these changes.
- Free external inference can be slow, unavailable, malformed or rate limited. The app retries invalid/failed inference once, then shows an error and preserves manual entry. A successful test does not guarantee future model availability or food-estimation accuracy.
- USDA uses its public demo key unless a server-only `USDA_API_KEY` is supplied. Its demo limits are 30 requests/hour and 50/day per IP. [USDA API guide](https://fdc.nal.usda.gov/api-guide/). OFF data is community-maintained; confirm against the package.
- Browser-local records do not synchronize to backend accounts. JSON export is available; a restore/import interface is not implemented.
- Public production inference remains disabled by default; authenticated access and durable quotas are required before public deployment.
- Full npm audit still reports five development-tool dependency advisories in the existing ESLint/fast-glob/braces chain. npm's suggested change downgrades the Next lint configuration across major versions; that incompatible downgrade was not applied. The production dependency audit previously returned zero advisories. Backend tests also emit upstream/deprecated UTC API warnings.

## Smart tools integration verification

See [INTEGRATIONS_IMPLEMENTATION.md](INTEGRATIONS_IMPLEMENTATION.md) for the ten integrated projects, actual live checks, setup commands and deployment boundaries. Real local speech and label recognition, public price/exercise APIs, constrained planning and backup conflict protection passed. Mealie deployment and household account binding remain pending.


## 22 October follow-through

See [unfinished-task status](UNFINISHED_TASKS_STATUS.md) for offline guest logging, background backup retry, direct microphone recording, current test results and exact remaining prerequisites. This supersedes the earlier offline recovery-page-only limitation. The backend count above is the previous verified baseline.

## Product-readiness pass — 22 October

261 automated checks passed across final runs: 128 web, 129 backend and 4 standalone parser checks. Build, TypeScript, ESLint, dependency consistency and a live account smoke test passed. See [release readiness results](RELEASE_READINESS_RESULTS.md) for the exact verified scope and remaining launch gates.
