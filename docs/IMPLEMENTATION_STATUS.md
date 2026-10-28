# TrackCal implementation — 2026-10-20

**Updated verification:** See [FEATURE_TEST_REPORT.md](FEATURE_TEST_REPORT.md) for the latest complete pass: 233 automated checks, real backend/MySQL workflows, live USDA search and fixes made after the initial implementation below.

## Implemented in the web client

- Server-only OpenRouter text and photo/label inference, defaulting to the free model router. The supplied credential is in ignored `.env.local`, never in client code.
- Validated structured nutrition with recomputed totals; malformed, empty and failed responses produce visible errors, not sample food.
- JSX photo upload uses actual image bytes. Demo presets are explicitly identified; invented depth/plate measurements were removed.
- ZXing camera barcode decoding with camera cleanup and typed-code fallback. Nutrients scale consistently with the user's selected grams.
- Browser-local journals by calendar date, persisted goals and recipe draft. Manual add/edit/repeat/delete, daily totals and full local JSON export.
- Dated water intake and goal, manual steps/activity duration and weight entries. No calorie burn is guessed or added to the food target.
- Recipe ingredient nutrition comes from explicit user input instead of a fixed made-up formula. Sample meal suggestions are labeled as samples.

## Evidence and checks

- REA public-page capture: `ev_2dd425d3cf4bdbd39aa8ef00bac5a150fb5a35e3d997382375f1ab94febbf24a`; controlled Edge launch, homepage DOM only, owned process cleaned up. This does not verify the mobile product.
- Live text request through `/api/analyze`: eggs/toast produced structured components and totals with `is_mock=false`; selected model `dots-studio/dots-3-note-preview:free`.
- Live vision request: synthetic 100g nutrition-label image returned 200 kcal, 12g protein, 20g carbohydrate and 8g fat exactly; model `nvidia/nemotron-3.5-super-vl:free`. This verifies wiring/label extraction on a fixture, not real-world food-estimation accuracy.
- HTTP smoke checks: empty request and invalid image rejected with 400; mismatched Origin rejected with 403.
- Browser: manual meal entry changed totals, survived page reload, and nutrition correction changed calorie totals. No physical camera/device was used for barcode validation.
- Automated nutrition tests reject empty, missing, negative, nonfinite and implausible values; verify recomputed totals and legitimate zero values.
- Production build and TypeScript pass. The latest ESLint run is clean. npm production dependency audit returned zero advisories at the time checked; development-tool advisories are documented in the feature test report. This is not a complete security review.

## Remaining work and boundaries

- No complete Cal AI mobile workflow parity claim: no mobile runtime/package was supplied or inspected.
- Mobile remains a prototype. Native health sync, permissions, workout imports, account/cloud synchronization, PDF export, reminders and advanced trend charts are not implemented by this change.
- FastAPI/MySQL now runs in tests using the bundled Python runtime and `backend/.venv`; database writes are rolled back. The normal system Python launcher remains unconfigured. Original local changes are preserved.
- Local data is browser/device-specific and unencrypted. Export is a JSON backup; restore/import UI is not yet implemented.
- New local inference route is disabled by default in production. Public hosting needs authenticated access and durable per-user quotas. Default free routing can fail or be rate limited; manual entry works without inference.
- Starter food and recipe examples remain labeled samples. The web food library now also provides explicit live USDA search; OFF results depend on community data and may be incomplete.

## Reproduce

From `frontend/web`, with Node 24 and installed dependencies:

```powershell
npm run build
npm run lint
node --experimental-strip-types --test tests/meal-analysis.test.mjs
npm run dev -- --hostname 127.0.0.1 --port 3002
# In a second terminal; explicitly invokes free external AI with synthetic data:
$env:RUN_LIVE_AI='true'
node tests/live-smoke.mjs
```

