# Bench method

This is how Version A (the frozen `legacy-baseline`) is measured, and how any later version will be measured with the same harness and rules. The code lives in `tools/bench/`, and results are written to `docs/bench/results/<LABEL>/`.

## Running it

Version A must be measured from a frozen checkout, so that no other work can change what is measured:

```
git worktree add --detach <dir> legacy-baseline
git -C frontend/web worktree add --detach <dir>/frontend/web legacy-baseline
cd <dir>/frontend/web && npm ci && npm run build          # copy .env.local first

# from the main repo
BENCH_REPO=<dir> DB_NAME=trackcal_phase3_test APP_ENV=testing backend/.venv/Scripts/python.exe tools/bench/serve_api.py 8007
cd <dir>/frontend/web && TRACKCAL_API_URL=http://127.0.0.1:8007 npx vite preview --port 3007 --strictPort

cd tools/bench && npm ci
pip install --target .pydeps waitress==3.0.2              # bench-only; the app's environment is unchanged
BENCH_REPO=<dir> BASE_URL=http://127.0.0.1:3007 API_URL=http://127.0.0.1:8007 LABEL=A node bench.mjs
A=A B=B node compare.mjs
```

`make bench` and `make bench-compare` wrap the same commands and pass `BENCH_REPO`, `BASE_URL` and `API_URL` through from the environment. On Windows without `make`, run the node commands directly, or install make with `winget install ezwinports.make`.

- `QUICK=1` does 1 run on 2 devices. It is only for checking the harness and is never valid for a comparison.
- `PARTS=journeys,screens,perf,load,code` runs a subset. `PARTS=report` measures nothing and rebuilds the summaries from saved data.
- `ONLY=J4` with `node lib/journeys.mjs` runs a single journey and writes a separate file, so the full results are never replaced.

**Prerequisites.** The app must be served at `BASE_URL`, and its API must use a test database (`BENCH_DB`, default `trackcal_phase3_test`). The seed refuses any database whose name doesn't contain `test` or `bench`. Preflight fails loudly, before anything is measured, if the web app, the API or Chrome isn't reachable.

**Freeze guard.** `provenance.json` records both commits, any uncommitted changes and the build time. A run stops with an error if `LABEL=A` isn't at the `legacy-baseline` tag in both repos, if the checkout has uncommitted changes, or if any of this changed by the end of the run.

## Fixed conditions

| Item | Value |
|---|---|
| Seed | `tools/bench/seed.py`, using `random.Random(20261030)`. Demo account `bench-demo@tests.example.com`: 106 meals over 30 days, 10 workouts, 3 favourites, 1 saved meal, XP and companion profile. The seed is rebuilt before every journey run. |
| Clock | The browser clock is installed at `<seed today>T10:00:00+05:30` (Playwright `clock.install`, which keeps running). The server clock is real, so "today" on the server is the real date. Seed dates are relative to it, so the two agree. |
| Locale / time zone | `en-IN`, `Asia/Kolkata` |
| Devices | android-360 (360×800, DPR 3, touch), iphone-390 (390×844, DPR 3, touch), tablet-768 (768×1024, DPR 2, touch), desktop-1280 (1280×800, DPR 1) |
| Themes | Light and dark (`prefers-color-scheme`) |
| Networks | normal (no throttling); slow4g = 150 ms RTT, 1.6 Mbps down, 750 kbps up, CPU slowed 4× (CDP) |
| Runs | 5 per measurement. Results report the median, min, max and spread = (max − min) / median. A spread over 15% is flagged ⚠ "unreliable". Journey spread is judged per device; the table shows the worse device. |
| API server | waitress, 8 threads, standing in for production's gunicorn (2 workers × 4 threads), which can't run on Windows |
| Browser | System Chrome via playwright-core 1.64.1, headless; service workers blocked except in the offline state |

## Counting rules

- **Tap**: one click, check or select-option on a control. Navigation by the harness to the journey's start URL does not count.
- **Keystroke**: one typed character. Text is typed with `pressSequentially`, never pasted. Pressing Enter counts as 1.
- **Seconds**: wall-clock time from the first action to the success check passing. This is lab replay speed, not human speed (see `HUMAN_FACTOR` in SCORECARD.md).
- **Max interaction ms**: the longest Event Timing entry (`duration`, interactions only) during the journey. This stands in for INP, which Lighthouse navigation runs can't measure.
- Also recorded per run: console errors, failed requests (status ≥ 400, excluding the anonymous session check), and route changes.

## Journeys

Every journey starts signed in as the demo account at its start URL, except J1, which starts signed out. "Success" means a check against stored data, not just what the screen shows.

| ID | Journey | Start | Path in Version A | Success check |
|---|---|---|---|---|
| J1 | Sign up to first food log | `/signup` (guest) | Sign up → "Continue tracking without finishing" → "Log a meal ↗" → name + calories → "Confirm diary entry" | The new account's diary has 1 entry |
| J2 | Log a meal by search | `/` | "Log a meal ↗" → search "rice" → Search catalog → Choose first result → Confirm diary entry | Today's diary +1, with a rice item |
| J3 | Log from favourites | `/` | "Log a meal ↗" → "Use favorite Idli with sambar" → Confirm diary entry | Today's diary +1, with Idli with sambar |
| J4 | Barcode, then manual fallback | `/` | Food → Barcode → type the unknown code `8909999000010` → Lookup → "Product not found" → Journal → Add meal | A device-journal meal is stored |
| J5 | Log a glass of water | `/` | Food → Journal → "+250 ml" | Water total in device storage +250 |
| J6 | Workout with one set | `/` | Move → Add "Wall push fundamentals" → Start → Add set → reps 10 → minutes 5 → Complete | `/api/wellness/training` shows one more completed session |
| J7 | Today's progress summary | `/` | Play → Progress | The progress heading is visible |
| J8 | Change language or theme | `/` | Appearance → Dark | `<html>` is dark. Version A has no translated interface, so only the theme is measured; this is noted on the result. |

**No data loss.** After every journey run, the harness checks that all 106 seeded meals still exist. A missing meal fails the `noDataLoss` gate.

## Screens

- **Coverage**: 21 member screens and 8 guest screens × 4 devices × 2 themes, as full-page screenshots.
- **States** (member screens, 360 px, light):
  - empty: a brand-new account
  - loading: slow4g, captured 700 ms after navigation
  - error: every `/api/**` call returns 503
  - offline: service worker allowed, then reloaded offline
- **Unreachable**: screens that fail to load are listed under `unreachable`, with the reason.
- **Audits** (360 and 1280):
  - computed font sizes, weights, colours, radii, shadows and spacing
  - WCAG text contrast per element
  - tap targets under 44 px
  - whether numbers use tabular figures
- **Accessibility and input checks**:
  - axe-core 4.14 (WCAG 2.2 A/AA) at 360 and 1280, light
  - an 80-Tab keyboard pass: traps, and focus without a visible indicator
  - 200% zoom (640×400 at DPR 2): horizontal scroll
- **Motion and fonts**:
  - running animations, with normal and reduced motion
  - a Hindi/Tamil font probe
- **Bundles**: JS and CSS bytes per route on desktop, light.

## Performance

- **Lighthouse 13.5**: mobile preset (slow 4G, 4× CPU), signed in, 7 main screens × 5 runs.
- **Load test (autocannon 8)**: 50 connections directly to the API server, without the Vite preview proxy. 4 endpoints run for 24 s each × 5 runs.
  - Food search allows 240 requests an hour per user, so it gets a fixed 200 requests at 50 connections × 5 runs, with the limit counters cleared before each run.
  - autocannon reports p97.5, which is shown as an upper bound for p95.
  - 429 responses are the app's own rate limit. They are reported separately from errors.

## Code health

- Lines of code, and files over 400 lines.
- jscpd duplication (70 tokens) and lizard cyclomatic complexity over 15.
- TypeScript `any` and `ts-ignore` counts.
- npm outdated and audit, and pip outdated.
- Coverage: pytest-cov (backend) and Vitest with v8 (web), per module.
- The add-a-field experiment (`results/<LABEL>/add-field-experiment.json`): the files that adding an optional "mood" field to a meal would touch, counted by tracing the code. Nothing was changed.

## Known limits

- **Clock**: only the browser clock is fixed (see Fixed conditions).
- **Server**: waitress on Windows, not gunicorn on Linux. Absolute API latencies won't match production; comparisons between versions on this setup are valid.
- **Database**: the app's database user can only use `trackcal_phase3_test`, so a version can't have its own. The schema must stay compatible with the version being measured.
- **Seconds are lab speed**: compare seconds between versions, not against human expectations.
- **J4/J5**: the device-journal path stores data in the browser, not on the server, so those checks read IndexedDB/localStorage.
- **INP**: not available from Lighthouse; see "Max interaction ms".
