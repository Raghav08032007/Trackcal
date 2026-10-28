# Third-party components

- **ics 3.12.1** — https://github.com/adamgibbons/ics — ISC. Generates meal-reminder and coach-appointment calendar files. Retain the installed package LICENSE.
- **PapaParse 5.5.3** — https://github.com/mholt/PapaParse — MIT. Parses the documented food-history CSV format locally. Retain the installed package LICENSE. Development types are provided by @types/papaparse.

- **@zxing/browser 0.2.0** — https://github.com/zxing-js/browser — MIT. Used for in-browser camera barcode decoding. Its installed package retains its LICENSE. The transitive **@zxing/library** package is Apache-2.0; retain its license/notices when distributing bundled software. See the installed packages for the full legal texts.
- **Open Food Facts** — https://world.openfoodfacts.org/ — database under ODbL, individual database contents under DbCL; product images under CC BY-SA. Data attribution and licenses: https://world.openfoodfacts.org/data. TrackCal uses product lookup, does not mirror the database, and does not newly bundle product images. If distributing an adapted database, review the applicable share-alike requirements.
- **OpenRouter** — https://openrouter.ai/ — hosted service, not an open-source inference engine bundled into TrackCal. `openrouter/free` is the default free inference router; provider limits, service terms and availability apply. No perpetual free hosting or unlimited AI is promised.
- **REA** — https://github.com/morluto/rea — investigation tooling already installed in the user's environment, not incorporated into the application or a source of Cal AI implementation code.
- **USDA FoodData Central** — https://fdc.nal.usda.gov/ — public-domain/CC0 food data. Used for live library search; values are per 100g and carry source attribution. The public demo API key has limited usage; a personal free key can be configured on the server.

No proprietary Cal AI code, branding, account data or private food dataset was incorporated. TrackCal implements its own workflows using its existing source and the dependencies above.

## Smart tools additions

- recipe-scrapers 15.13.0 — https://github.com/hhursev/recipe-scrapers — MIT.
- ingredient-parser-nlp 2.9.1 — https://github.com/strangetom/ingredient-parser — MIT; NLTK resources retain their upstream notices.
- OR-Tools 9.12.4544 — https://github.com/google/or-tools — Apache-2.0.
- Dexie 4.4.6 and dexie-react-hooks 4.4.0 — https://github.com/dexie/Dexie.js — Apache-2.0.
- Grocy 4.7.1 — https://github.com/grocy/grocy — MIT; portable PHP retains the PHP license and bundled extension notices.
- Mealie 3.29.0 — https://github.com/mealie-recipes/mealie — AGPL-3.0. Optional separate service, not deployed here; retain source/license obligations when distributing or modifying it.
- PaddleOCR 3.3.2 and PaddlePaddle 3.2.2 — https://github.com/PaddlePaddle/PaddleOCR — Apache-2.0 code; downloaded model files retain upstream metadata and licenses.
- whisper.cpp — https://github.com/ggml-org/whisper.cpp — MIT; pywhispercpp 1.5.1 binding — https://github.com/absadiki/pywhispercpp — MIT. Official tiny Whisper model downloaded from https://huggingface.co/ggerganov/whisper.cpp; retain upstream model notices.
- Open Prices — https://github.com/openfoodfacts/open-prices — AGPL-3.0 service code; public food-price data under ODbL. TrackCal queries the API and preserves source attribution.
- wger — https://github.com/wger-project/wger — AGPL-3.0 service code; exercise entries have individual licenses and authors. TrackCal displays returned license/author/source information; this does not grant a blanket license to every entry.

These services have separate licenses from TrackCal. Retain installed LICENSE/NOTICE files and review redistribution obligations for any packaged deployment.

Production readiness additions: PyJWT 2.15.1 (MIT) replaces python-jose/ECDSA in the active API; Tailwind PostCSS remains MIT. Optional MySQL/Caddy container images carry their upstream licenses. No Cal AI proprietary implementation was added.


## Phase 4 — MediaPipe

Pinned npm runtime `@mediapipe/tasks-vision@1.2.0` from Google MediaPipe (Apache-2.0). Retained license: [mediapipe-LICENSE](third_party/mediapipe-LICENSE), also copied alongside generated public runtime assets. Project source: https://github.com/google-ai-edge/mediapipe. Official task guide: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js. Self-hosted model: pose_landmarker_lite / float16 / version 1 from the official Google MediaPipe models bucket; exact URL/hash/size in phase4-model-manifest.json. Keep notices and re-review upstream terms/model distribution when upgrading. No paid cloud vision dependency is introduced; asset hosting/build/download and device compute still have costs.

The official public mediapipe-assets/pose.jpg image was used temporarily for a static inference test, not shipped as product artwork or a new training dataset. Only aggregate result/performance evidence is retained. The browser harness reuses the existing local Playwright runtime; psutil was installed only into the local backend environment for safe process inspection, not added as an application requirement.
