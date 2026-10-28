# Smart tools implementation — 2026-10-21

Open [Smart tools](http://127.0.0.1:3002/tools) from the dashboard sidebar. Imported nutrition, ingredient weights and OCR output require review before journal entry. Missing data is never filled with invented nutrition.

## Integrated projects

| Project | Purpose | Verified state |
| --- | --- | --- |
| [recipe-scrapers](https://github.com/hhursev/recipe-scrapers) 15.13.0 | Import recipe URLs | Installed; real public recipe extracted; HTTPS/DNS/redirect/size guards tested |
| [ingredient-parser](https://github.com/strangetom/ingredient-parser) 2.9.1 | Parse ingredient quantities and units | Installed; real parser exercised through the web API; ambiguous weights require review |
| [OR-Tools](https://github.com/google/or-tools) 9.12.4544 | Budget and nutrition constrained meal plans | Installed; real CP-SAT solver tested; infeasible constraints reported |
| [Dexie](https://github.com/dexie/Dexie.js) 4.4.6 | IndexedDB recovery and backup queue | Integrated; account isolation, persistence and conflict tests pass |
| [Grocy](https://github.com/grocy/grocy) 4.7.1 | Household pantry source | Portable PHP service installed; authenticated stock API passed. TrackCal access awaits household owner identity |
| [Mealie](https://github.com/mealie-recipes/mealie) 3.29.0 | Household recipe import | Adapter and Compose configuration complete; protocol tests pass. Service not deployed on this host |
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) 3.3.2 | Nutrition label recognition | Isolated CPU worker installed; real image returned 200 kcal, 12g protein, 20g carbs, 8g fat |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp), via pywhispercpp 1.5.1 | Local meal speech transcription | CPU binding and tiny multilingual model installed; real WAV transcribed correctly |
| [Open Prices](https://github.com/openfoodfacts/open-prices) | Public price observations | Live API returned 20 observations; currency/date/unit uncertainty retained |
| [wger](https://github.com/wger-project/wger) | Exercise discovery and manual workout records | Live API returned 6 squat matches; attribution/license retained |

Existing ZXing barcode, Open Food Facts, USDA and OpenRouter features remain available. REA is investigation tooling, not application code.

## Setup and operation

From `backend`, use Python 3.12 and install `requirements-dev.txt` for the API plus integration tests. For application-only installation, install `requirements.txt` and `requirements-integrations.txt`. Download parser data with `python -m nltk.downloader -d nltk_data averaged_perceptron_tagger_eng`. Run `python scripts/setup_whisper.py` to download the verified official model. Start the API with `python -m uvicorn main:app --host 127.0.0.1 --port 8000`.

Install `requirements-ocr.txt` in a separate `.venv-ocr`, then run `.venv-ocr/Scripts/python -m uvicorn services.ocr_worker:app --host 127.0.0.1 --port 8011`. Set `PADDLEOCR_URL=http://127.0.0.1:8011` in the ignored backend environment. The first request downloads models and takes longer. English labels were verified; other languages and physical camera/microphone capture were not tested.

Portable Grocy setup: `python scripts/setup_grocy.py`, then `runtime/php/php.exe -c runtime/php/php.ini -S 127.0.0.1:9283 -t runtime/grocy/public runtime/grocy-router.php`. Complete the Grocy account setup locally. `python scripts/connect_grocy.py` provisions a 30-day local connector key without printing it. Set `INTEGRATION_OWNER_ID` to the intended TrackCal account UUID before private household reads are allowed. No owner has been guessed or granted access.

For container deployments, `docker compose -f compose.integrations.yml --profile household up -d` starts the optional household services; the `ocr` profile builds the OCR worker. Docker is unavailable on this host, so Compose runtime deployment is unverified. Native Mealie 3.29.0 requires Python 3.14; the main API uses 3.12. Configure Mealie and its server-only API key before using its adapter. See `backend/integrations.env.example`; keep all keys in ignored environment files.

From `frontend/web`, install with `npm ci`, then `npm run dev -- --port 3002`. Production build uses `npm run build` and `npm start -- --port 3002`.

## Verification and limits

110 web tests, 119 backend tests and 4 standalone parser tests passed: **233 automated checks**. Production build and ESLint passed. The final backend run used OR-Tools 9.12.4544 and protobuf 5.29.6; `pip check` passed. Use a writable workspace pytest `--basetemp` if the shared Windows temporary directory is inaccessible.

The opt-in `tests/live-integrations.mjs` passed against the running web/API, actual parser and optimizer, local Whisper and PaddleOCR workers, Open Prices and wger. It also checked shopping subtraction and cloud revision conflicts, and deactivated its synthetic account afterward. Enable with `RUN_LIVE_INTEGRATIONS=true` and optionally `TEST_PUBLIC_APIS=true`.

Earlier browser checks exercised recipe review/save, plan generation, shopping, pantry and IndexedDB write/read/delete. Services bind to loopback. Local services must be running for media and private service adapters. Manual entries remain available when remote services fail. The backup queue retries while Smart tools is open; conflicts require review. The service worker provides a public offline recovery page, not a complete cold-start offline application. This verification covers the web app and API, not the separate Expo prototype or nutrition-model accuracy.

## 22 October update

Offline guest journaling and background backup retry are now implemented, together with direct microphone recording. See [completion follow-through](UNFINISHED_TASKS_STATUS.md) for verification and remaining household/deployment/device prerequisites.
