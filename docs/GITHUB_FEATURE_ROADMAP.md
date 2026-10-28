# GitHub integration shortlist for TrackCal

Research date: 2026-10-21. This is a proposed integration roadmap, not a record of installed dependencies. Repository READMEs, license declarations, APIs and selected release notes were inspected. No shortlisted package was installed or benchmarked in TrackCal.

## Product recommendation

Develop a practical loop: import a recipe, match its ingredients to food records, plan meals around the user's chosen targets and budget, subtract pantry stock, and generate a shopping list. This extends TrackCal beyond logging into helping users decide what to cook and buy.

Features below are TrackCal proposals based on each project's capabilities. They are not claims that installing a repository automatically delivers the whole workflow.

| Priority | Repository | Customer problem / proposed feature | Integration with this project | Declared license / effort |
|---|---|---|---|---|
| 1 | [hhursev/recipe-scrapers](https://github.com/hhursev/recipe-scrapers) | Re-entering recipes is tedious. Import a recipe from a user-provided URL into Recipe Studio. | Python backend adapter using `scrape_html`; fetch HTML with public-address restrictions, size/time limits and redirect validation. Preview ingredients and servings before saving. | MIT / Medium |
| 2 | [strangetom/ingredient-parser](https://github.com/strangetom/ingredient-parser) | Ingredient text is difficult to calculate. Parse quantities, units and food names for editable nutrition matching. | Python adapter; map extracted ingredients to existing USDA/OFF food records. Require confirmation for uncertain matches and volume-to-weight conversions. | MIT / Medium |
| 3 | [google/or-tools](https://github.com/google/or-tools) | Users know their goals but do not know what meals fit. Generate meal plans with budget, nutrition, availability, variety and preparation-time constraints. | Python optimization service, using reviewed recipes, known prices and user-selected targets. Return an explanation when no feasible plan exists. | Apache-2.0 / High |
| 4 | [grocy/grocy](https://github.com/grocy/grocy) | Food expires unused and users buy duplicates. Pantry stock, expiry dates and shopping lists can support suggestions to use ingredients already available. | Separate self-hosted PHP service accessed through its REST API. TrackCal must add ingredient mappings and household access control. Do not merge its full application into the Next/FastAPI codebase. | MIT / High |
| 5 | [dexie/Dexie.js](https://github.com/dexie/Dexie.js) | Browser localStorage and explicit backups limit offline reliability. Store structured journals and pending sync operations in IndexedDB. | Replace the persistence adapter gradually; preserve per-user isolation. Add a service worker for offline app loading and implement the sync queue/conflict rules against our FastAPI service. Dexie alone does not provide these features. | Apache-2.0 / Medium–High |
| 6 | [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | Small label text and multilingual packaging are hard to enter. Extract nutrition-label text for a reviewable structured draft. | Isolated Python inference worker, then deterministic parsing of units, per-100g/per-serving values and decimal conventions. Benchmark actual local labels. It is not a food-portion estimator or allergen-safety guarantee. | Apache-2.0 code / High; inspect selected model terms too |
| 7 | [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | Speech logging currently depends on browser recognition support. Offer local audio transcription before the existing meal parser. | CPU server or WebAssembly prototype; benchmark model size, latency and regional food names. Transcription alone does not calculate nutrition. | MIT code / High; verify chosen model artifacts |
| 8 | [openfoodfacts/open-prices](https://github.com/openfoodfacts/open-prices) | Users cannot compare food value. Add price observations and cost-per-serving/protein-unit comparisons. | Read-only API adapter joined by barcode; display store, currency, date and source. Accept manual prices where local coverage is absent. Keep personal receipt uploads private unless explicitly shared. | AGPL-3.0 code; ODbL data / Medium–High |

Effort estimates are relative engineering judgments, not delivery commitments. They include UI, persistence, adapters and useful verification, not just package installation.

## Larger optional services

- [mealie-recipes/mealie](https://github.com/mealie-recipes/mealie): recipe import, weekly planning, shared cookbooks and shopping lists through a REST API. AGPL-3.0. Consider if household planning is a major product requirement; it overlaps with the proposed lightweight recipe stack and adds another account/data system. Do not integrate both paths initially.
- [wger-project/wger](https://github.com/wger-project/wger): exercise catalog, workout routines, body measurements and progress tracking. Application code is AGPL-3.0-or-later; exercise/media data has separate licenses. Consider later if TrackCal expands into workout planning. It does not itself connect this web app to Apple Health or Android Health Connect.

## Maintenance observations

- [OR-Tools metadata](https://api.github.com/repos/google/or-tools) reported a push on 2026-10-20 and `archived: false`.
- [recipe-scrapers releases](https://github.com/hhursev/recipe-scrapers/releases) showed 15.13.0, dated 18 October; release notes require Python 3.11+ and document changed yield parsing.
- [Ingredient Parser releases](https://github.com/strangetom/ingredient-parser/releases) include recent parsing fixes and a 2026 FoodData Central update.
- [Dexie releases](https://github.com/dexie/Dexie.js/releases) show ongoing maintenance; the displayed 4.4.7 release is marked prerelease. Select a tested stable version rather than automatically choosing the top release.
- [Mealie releases](https://github.com/mealie-recipes/mealie/releases) showed v3.29.0 dated 17 October; [Grocy releases](https://github.com/grocy/grocy/releases) showed v4.7.1 dated 4 September.
- [Whisper.cpp releases](https://github.com/ggml-org/whisper.cpp/releases) and [PaddleOCR's README updates](https://github.com/PaddlePaddle/PaddleOCR) show continued model/runtime work. This does not establish performance on TrackCal's deployment hardware.
- Exact commit recency was not independently established for every candidate; direct GitHub metadata retrieval was unavailable for most repositories in this session. Release activity is a maintenance signal, not a security audit.

## Integration order and acceptance criteria

1. **Recipe import + ingredient parsing:** reviewable import; correct serving handling; preserve unknown nutrition instead of inventing values; block private-network fetches; fixture tests for supported recipe formats and failed sources.
2. **Meal planner:** connect reviewed recipes, targets and manually entered prices. Test budget/macro arithmetic, ingredient exclusions, preparation time, variety and infeasible requests. Google's [Stigler diet example](https://developers.google.com/optimization/lp/stigler_diet) demonstrates cost-constrained nutritional optimization; TrackCal still needs real meal preferences and product logic.
3. **Pantry + shopping:** start with stock and expiry dates, then subtract available ingredients from shopping requirements. Keep unit conversions explicit and test household ownership.
4. **Offline resilience:** migrate local data transactionally; test account switching, device restarts, failed synchronization and conflicting edits. Use our existing backend rather than assume the separate Dexie Cloud service is free.
5. **Local OCR/voice and external prices:** add only after representative device, label, language and geographic coverage benchmarks.

All shortlisted code is open-source, but hosting, model execution and maintenance still require resources. Preserve each selected dependency's notices. Code licenses do not automatically grant reuse rights over scraped recipe content, data or model weights. AGPL services and ODbL data need their applicable obligations evaluated for the actual integration.

## Implementation follow-through

The selected integrations are implemented. See [current integration states and verification](INTEGRATIONS_IMPLEMENTATION.md), including pending Mealie deployment and household owner binding.
