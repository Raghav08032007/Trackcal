# A vs B

Generated 2026-10-31T06:20Z from summary.json files; formulas in docs/bench/SCORECARD.md.

**Verdict:** A fails a hard gate; B passes them all and wins.

## Scorecard

| Category | Weight | A | B | Δ |
|---|---|---|---|---|
| speed | 30 | 94 | 94 | +0 |
| visual | 20 | 19 | 83 | +64 |
| performance | 15 | 52 | 68 | +16 |
| maintainability | 15 | 75 | 74 | -1 |
| regression | 10 | 100 | 100 | +0 |
| habit | 10 | 100 | 100 | +0 |
| **Total** | 100 | **71** | **86** | +15 |

## Hard gates

| Gate | A | B |
|---|---|---|
| noDataLoss | PASS | PASS |
| wcagTextContrast | **FAIL** | PASS |
| zeroRegressions | PASS | PASS |
| allJourneysSucceed | PASS | PASS |

## Journeys (medians)

| Journey | Taps A → B | Keys | Seconds | Max interaction ms | Success |
|---|---|---|---|---|---|
| J1 First run: sign up to first successful food log | 4 → 4 | 73 → 73 | 4.09 → 4.4 | 48 → 56 | 100% → 100% |
| J2 Log a meal by search from the home screen | 4 → 4 | 4 → 4 | 3.1 → 3.82 | 40 → 56 | 100% → 100% |
| J3 Log a meal from favourites or recents | 3 → 3 | 0 → 0 | 2.23 → 2.49 | 40 → 64 | 100% → 100% |
| J4 Barcode flow with manual fallback | 5 → 5 | 31 → 31 | 2.93 → 2.47 | 40 → 52 | 100% → 100% |
| J5 Log a glass of water | 3 → 3 | 0 → 0 | 2.1 → 2.24 | 32 → 40 | 100% → 100% |
| J6 Start a workout and log one set | 5 → 5 | 3 → 3 | 2.27 → 2.87 | 48 → 64 | 100% → 100% |
| J7 Find today's progress summary | 2 → 2 | 0 → 0 | 0.97 → 1.29 | 36 → 48 | 100% → 100% |
| J8 Change language or theme | 1 → 1 | 0 → 0 | 0.06 → 0.06 | - → - | 100% → 100% |

⚠ Spread over 15% on J1, J2, J3, J4, J6, J7, J8: treat those time differences as noise.

## Detail scores

| Criterion | A | B |
|---|---|---|
| visual.axe | 0 | 100 |
| visual.contrast | 0 | 100 |
| visual.tapTargets | 63 | 54 |
| visual.tokens | 0 | 0 |
| visual.keyboard | 96 | 96 |
| perf.lighthouse | 69 | 87 |
| perf.lcp | 0 | 31 |
| perf.cls | 83 | 100 |
| perf.apiP95 | 20 | 17 |
| perf.apiErrors | 100 | 100 |
| maint.duplication | 100 | 100 |
| maint.bigFiles | 82 | 82 |
| maint.complexity | 14 | 8 |
| maint.typeEscapes | 100 | 100 |
| maint.addField | 80 | 80 |

## Run settings

- A: http://127.0.0.1:3007 · 5 runs · 2026-10-31T06:04:56.969Z
- B: http://127.0.0.1:3008 · 5 runs · 2026-10-31T06:20:18.797Z

