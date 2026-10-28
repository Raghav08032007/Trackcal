# Cal AI reference audit and TrackCal feature gaps

Reviewed 20 October 2026. This is a public-product comparison and a bounded source review, not a claim of complete Cal AI parity.

## Evidence and scope

- Cal AI's official [homepage](https://www.calai.app/) advertises photo, barcode and descriptive meal entry, macro estimates, custom foods/recipes and fitness integration. Its nutrition and depth-sensor statements are vendor claims, not independently measured accuracy.
- Its official [FAQ](https://www.calai.app/faq) describes manual search, cloud account recovery, PDF exports, health-platform steps, subscription friction and scan errors. The FAQ's own accuracy statement is not a benchmark for TrackCal.
- REA evidence `ev_2dd425d3cf4bdbd39aa8ef00bac5a150fb5a35e3d997382375f1ab94febbf24a`: parent investigator captured the public homepage DOM through an Edge browser scenario. This establishes public rendered-page content only. It does not establish authenticated mobile behavior, private APIs, food-database contents, model implementation or end-to-end purchase/scan workflows.
- Source inspection below describes the pre-change baseline in this workspace. Application edits made alongside this report require their own tests and should not be inferred from this baseline matrix.
- Similar names exist in app stores. No claims from unrelated `caliaiapp.com` or `com.caloriesense.ai` listings are included.

## Baseline feature matrix

| Customer task | Public Cal AI evidence | TrackCal source evidence before this change | Gap / practical next step |
| --- | --- | --- | --- |
| Photograph a meal and review its macros | Homepage | `backend/routers/ai_scan.py` has photo routes and AI predictions; web uses scan presets | Connect real image input to inference; clearly identify provider failures and estimates |
| Describe a meal | Homepage | Backend text route exists; `frontend/web/src/lib/api.ts` returns fixed nutrition on request failure and sends JSON to a form-based route | Align request contracts; remove silent invented results |
| Scan a packaged-food barcode | Homepage | Open Food Facts backend/client lookup exists; web accepts entered code | Add camera decoding with manual fallback; preserve data provenance |
| Search and manually log food | FAQ | Food search/custom-food and meal-log routes exist; web has database/log interfaces | Connect state and persistence; enable manual entry when inference is unavailable |
| Correct portion size or a mistaken prediction | Customer need; correction UX not verified in Cal AI runtime | Backend correction route and confirmation endpoint; web portion controls are preset-based | Editable item names, grams and nutrients before saving; recompute totals |
| Reuse a meal or recipe | Homepage custom foods/recipes | Recipe routes, saved-meal model and meal-copy route | Make repeat logging available in the active client |
| Review daily/weekly progress | Homepage calorie/macro tracking; detailed chart behavior not observed | `nutrition.py` daily, weekly and monthly endpoints; web/mobile include sample state | Base summaries on real saved entries and selected dates |
| Recover history after returning | FAQ cloud-account recovery | JWT backend/accounts and database models exist; mobile uses local component state | Persist journal; local storage is single-browser persistence, not cloud sync |
| Export history | FAQ mentions PDF export | `users.py` export only includes log/recipe metadata and says full export is available through support | Complete self-service export including actual foods and nutrients; PDF remains separate work |
| Track steps and exercise | Homepage and FAQ health integrations | No exercise/step model or connector found in the reviewed model/routes | Native health permissions and deduplication need separate implementation |
| Log water | Not established by selected Cal AI pages | Backend water entry route; mobile local water counter | Persist water and connect it to daily summaries |
| Follow a personal calorie target | Broad goal framing on homepage; onboarding workflow not observed | Backend onboarding calculation and user settings exist; client/backend field and result names differ | Align contract and persist chosen targets |
| Track weight over time | Not established by selected Cal AI pages | User profile has current weight; no dated weight-entry model found | Add dated entries and trends if prioritized; do not claim verified competitor parity |
| Use nutrition-label OCR | FAQ mentions photographing a label; dedicated workflow unverified | Scan type comment mentions OCR; no separate OCR endpoint found | Add explicit label input and editable extracted values |

Static existence of a route or model is not evidence that its client flow currently works. This audit did not run FastAPI or MySQL.

## Customer problems worth solving first

1. **Trust in results:** failed requests must not quietly produce confident sample nutrition. Show actionable errors, identify estimates and allow manual correction. Baseline fake fallback behavior is directly visible in `api.ts` and `ai_scan.py`.
2. **Logging effort:** camera barcode reading, real photo input, editable portions and repeat meals reduce repeated typing. Keep manual entry available without paid inference.
3. **Lost history:** save meals and water across reloads, show the saved date, and offer an export. Browser persistence can be an initial improvement but cannot promise cross-device recovery.
4. **Unexpected cost:** free core logging, lookup and editing should remain usable when a model is rate-limited. OpenRouter free routing is externally hosted and availability-dependent; it does not guarantee unlimited inference.
5. **Hidden oil and mixed dishes:** keep portions and oil assumptions editable for home cooking. Heuristic adjustments must be presented as estimates rather than measured absorption.

These are design priorities inferred from the source gaps and public support topics; no customer interviews or usability study were performed.

## Free/open-source reuse and attribution

| Component | Evidence | Appropriate reuse | Conditions and limits |
| --- | --- | --- | --- |
| ZXing browser layer, `@zxing/browser` | [Repository](https://github.com/zxing-js/browser), [MIT license](https://github.com/zxing-js/browser/blob/master/LICENSE) | Decode barcodes from camera/image in the web client without a paid scanning service | Retain copyright and license notice when distributing. The browser wrapper's MIT license does not replace license obligations of transitive dependencies; inspect the installed version and `@zxing/library` notices. Camera permissions and browser support still apply. |
| Open Food Facts API/data | [Official API introduction](https://openfoodfacts.github.io/openfoodfacts-server/api/), [reuse conditions](https://world.openfoodfacts.org/terms-of-use) | Existing product lookup can supply packaged-food nutrients, ingredients and provenance | Database ODbL, individual database contents DbCL, product images CC BY-SA. Preserve attribution; evaluate database share-alike requirements when combining/reusing data. Missing fields and product coverage remain possible. Follow current API limits, use caching/backoff, and use bulk exports instead of crawling many products. |
| REA | [Repository](https://github.com/morluto/rea) | Investigate public runtime behavior and retain evidence for requirements | An analysis tool, not a source of Cal AI proprietary code, private datasets or guaranteed behavior parity. No Cal AI code or assets are imported by this report. |

Candidate selection is intentionally narrow: reuse the existing lookup integration and a focused scanner library rather than importing an unrelated full app. No claim is made that OpenRouter models, hosting, databases or native health-platform integrations are costless to operate.

## Remaining verification

- Real image, text and label requests must be tested independently against the selected provider; a successful text response does not prove vision works.
- Verify malformed/error responses do not become plausible sample results.
- Verify scan-to-review-to-save, reload persistence, item editing and summaries through the active web client.
- Test barcode camera permissions on actual target devices; build success cannot establish camera usability.
- Native mobile health sync, cross-device accounts, complete cloud export and competitor mobile workflows remain outside this public-page evidence.
