# Phase 2 test report: nutrition and barcode reliability

Date: 29 October 2026. Branch `codex/phase-4-camera-tracking`. Windows 11, Node 24.19, Python 3.12, MySQL 8.0 (dev
`global_food_ai`; browser journeys on the disposable `trackcal_phase3_test`), headless Chrome stable.

**Simulated vs real:** no real AI provider, phone or camera was used. Browser journeys answer the browser's
`/api/analyze` request themselves; backend tests replace the provider and Open Food Facts with fakes. Barcode and
IFCT data are real (IFCT seeded from the pinned package; Open Food Facts cached responses in tests are synthetic).

## Results by area

| # | Area | Result | Detail |
|---|---|---|---|
| 2a | Barcode service | **PASS** | GS1 check digit, 30-day/24-hour cache, 5 s timeout + 1 retry, circuit breaker (3 failures → 60 s), unknown values stay unknown, concurrent lookups safe. Commit `852c62ff` |
| 2a | Shared nutrition maths | **PASS** | Python and TypeScript modules give identical results (half-up rounding, unknown-aware totals, Atwater check, serving units) |
| 2b | IFCT 2017 catalog | **PASS WITH LIMITATIONS** | 542 foods, 19 languages, idempotent re-seed, oils/fats estimated and marked. **Launch gate: NIN written permission** (`DATA_SOURCES.md`). 20-food spot check against the printed tables is the owner's |
| 2b | Search | **PASS** | Synonym table, word-anywhere FULLTEXT, typed word *and* synonym searched, ranking favourites > recent > verified, matched local name and source shown, "add it yourself" empty state. Commit `28a7c8cd` |
| 2b | Migration 0004 | **PASS** | Dry run on a data copy: upgrade, downgrade, re-upgrade; no user rows lost (logged meals keep their copy) |
| 2c | Photo privacy | **PASS** | Browser shrinks to ≤1024 px and re-encodes (EXIF/GPS gone, proven in Chrome: 2400×1200 rotated photo → 512×1024, no `Exif`, no maker string). Server repeats it with Pillow and refuses >40 MP images. Nothing stored |
| 2c | AI cost and abuse caps | **PASS** | Per account (`DAILY_AI_LIMIT`), per guest address (`GUEST_DAILY_AI_LIMIT`), service-wide (`GLOBAL_DAILY_AI_LIMIT`), in every environment. Provider never called past a cap; message points to manual logging |
| 2c | Portion range + confidence | **PASS WITH LIMITATIONS** | Model's own low/high when valid, otherwise a confidence-derived band, labelled differently. Not measured on real meals (KI-19) |
| 2c | Confirm before saving | **PASS** | Unchanged: consent checkbox before upload, "Log This Meal" before anything is saved, failure keeps manual logging |
| 2c | Diary correctness | **PASS** | Day follows the person's time zone (00:30 IST counts as the next day); same-day edit keeps the meal's time; delete → **Undo**; copy yesterday with preview; retries never duplicate |
| 2c | Device journal → account | **PASS** | Explicit preview, per-meal choice, content-derived ids (a second copy adds nothing), device copy unchanged, "portion not recorded" shown honestly |

## Test counts (final run)

| Suite | Earlier record | After Phase 2 |
|---|---|---|
| Backend pytest (`pytest tests`) | 417 after part 2a (pre-Phase 2 count not recorded) | **452 passed** |
| Web vitest | 177 at step 5 | **201 passed** (37 files) |
| Standalone `node --test tests/meal-analysis.test.mjs` | 4 | **5 passed** |
| TypeScript `tsc --noEmit` / ESLint | pass / 0 | **pass / 0 errors** |
| Browser `e2e-p2-search.mjs` (new) | — | **13/13** desktop + 360 px, incl. catalog outage |
| Browser `e2e-p2-diary.mjs` (new) | — | **10/10** desktop + 360 px |
| Browser `e2e-studio.mjs` (regression) | 14 | **14/14** |
| Browser `e2e-phase3.mjs` (regression) | passing at step 4 | **17/17**, 0 page errors, 0 AI requests |

Earlier figures come from the step 5 record and the part 2a commit. New backend files: `test_barcode_lookup.py`, `test_nutrition_math.py`,
`test_food_search.py`, `test_photo_scan.py`, `test_diary_correctness.py`. New web files: `nutrition-math.test.ts`,
`barcode-save.test.tsx`, `photo-prep.test.ts`, `diary-tools.test.tsx`.

## Failure paths covered

Catalog unreachable (error shown, stale results cleared), barcode provider down / circuit open / not found / invalid
check digit, incomplete product (logging blocked until the label values are typed), AI over a cap (no provider call),
provider 401/429/5xx and malformed replies, spoofed or oversized images, decompression bombs, cross-user edit / delete /
restore (404), special characters and overlong search queries.

## Defects found and fixed during Phase 2

1. Synonyms hid catalog foods: "ragi" became "finger millet", which IFCT doesn't use. Both words are now searched.
2. A failed search left the previous "Add *food* yourself" prompt on screen.
3. **Undo delete could not be clicked:** the floating notice had `pointer-events:none`, which its buttons inherited.
   On desktop the notice also sat under the top tab bar. Both fixed in `navigation.css`.
4. Editing a meal moved it to "now" (or noon for past days); it now keeps its time unless the day changes.
5. The browser sent the original photo, full size with EXIF (including GPS), to the AI provider.
6. Guests and signed-in people outside one production mode had no daily AI cap, and there was no service-wide cap.
7. `.env.example` suggested `OPENROUTER_MODEL=openrouter/free`, the setting that earlier picked a non-vision model.
   (Your `.env` uses named models and was not affected.)

## How to rerun the browser journeys

```
cd backend
python scripts/setup_phase3_test_db.py      # copies IFCT foods + synonyms (public data only)
DB_NAME=trackcal_phase3_test python scripts/seed_phase3_e2e.py   # Phase 3 fixture (KI-20)
DB_NAME=trackcal_phase3_test APP_ENV=testing python -m flask --app "flask_app:create_app()" run --port 8003
cd ../frontend/web && npx vite build && TRACKCAL_API_URL=http://127.0.0.1:8003 npx vite preview --port 3003
node tests/e2e-p2-search.mjs && node tests/e2e-p2-diary.mjs
```
`e2e-p2-diary.mjs` needs `backend/runtime/p2-phone-photo.jpg`, a generated 2400×1200 JPEG with EXIF orientation 6,
a maker tag and GPS. Make it with the `phone_photo()` recipe in `backend/tests/test_photo_scan.py`, saved to that path. All synthetic accounts the
journeys created were deleted from the test schema afterwards.

## Open items (owner)

- NIN written permission for IFCT before public launch; spot-check 20 IFCT foods.
- Try ~20 real meal photos with the configured free models to judge the portion ranges (KI-19).
- Update `OPEN_FOOD_FACTS_APP_NAME/CONTACT` in `backend/.env`; rotate the OpenRouter key that was pasted in chat.
- New known issues: KI-17 to KI-20 in `KNOWN_ISSUES.md` (all severity 3).
