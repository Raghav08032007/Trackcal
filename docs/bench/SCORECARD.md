# Scorecard

The formulas were fixed before any Version B existed and live in `tools/bench/lib/scorecard.mjs`. Change them only with a note here, and re-score both versions with `make bench-compare`.

**Scale.**
- Each criterion is scored from 0 to 100.
- A category is the weighted mean of its criteria.
- The total is the weighted sum of the categories.

**Missing data.** A criterion that couldn't be measured is left out of its category's average. A category that couldn't be measured scores 0 in the total.

## Weights

| Category | Weight |
|---|---|
| Task speed and taps | 30 |
| Visual quality and accessibility | 20 |
| Performance | 15 |
| Maintainability | 15 |
| Regression safety | 10 |
| Habit-loop features | 10 |

## 1. Task speed and taps (30)

Each journey's score is 60% taps and 40% time, using the median over successful runs. A failed journey scores 0. The category score is the mean over J1–J8.

- **Taps**: 100 − 15 × (taps over ideal).
- **Time**: 100 at the ideal time, falling linearly to 0 at 3× the ideal. `HUMAN_FACTOR` = 1, so it is lab time.

| | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 |
|---|---|---|---|---|---|---|---|---|
| Ideal taps | 4 | 4 | 2 | 5 | 1 | 4 | 1 | 2 |
| Ideal seconds | 25 | 10 | 5 | 15 | 3 | 12 | 3 | 4 |

## 2. Visual quality and accessibility (20)

| Criterion | Weight | Formula |
|---|---|---|
| axe | 0.40 | 100 − 10 per serious or critical violation (summed over screens) |
| contrast | 0.25 | 100 − 5 per distinct failing text/background colour pair |
| tapTargets | 0.15 | 100 − 4 × (average controls under 44 px per screen) |
| tokens | 0.10 | 100 − 5 per font size over 8, − 2 per colour over 24, − 2 per spacing value over 12 |
| keyboard | 0.10 | 100 − 25 per keyboard trap, − 2 per focus stop without a visible indicator |

## 3. Performance (15)

| Criterion | Weight | Formula |
|---|---|---|
| lighthouse | 0.45 | Mean of Lighthouse performance scores |
| lcp | 0.20 | 100 at ≤ 2.5 s, falling to 0 at 4 s |
| cls | 0.10 | 100 at ≤ 0.1, falling to 0 at 0.25 |
| apiP95 | 0.15 | 100 at ≤ 300 ms, falling to 0 at 1000 ms (p97.5 used as the bound) |
| apiErrors | 0.10 | 100 at 0%, falling to 0 at 5% (429s excluded) |

## 4. Maintainability (15)

| Criterion | Weight | Formula |
|---|---|---|
| duplication | 0.30 | 100 at ≤ 3%, falling to 0 at 15% |
| bigFiles | 0.20 | 100 − 3 per app file over 400 lines |
| complexity | 0.20 | 100 − 2 per function with complexity > 15 |
| typeEscapes | 0.10 | 100 − 2 per `any` or `ts-ignore` |
| addField | 0.20 | 100 − 10 per app file touched beyond 4 |

## 5. Regression safety (10)

| Criterion | Weight | Formula |
|---|---|---|
| Test suites | 0.40 | 100 if both suites pass (with more than 0 tests), otherwise 0 |
| Coverage | 0.40 | Mean of backend and web line coverage: 100 at ≥ 80%, falling to 0 at 40% |
| Journeys | 0.20 | Share of journeys that succeed |

## 6. Habit-loop features (10)

The share of these features that are present, each with its evidence:

- quick re-log (J3)
- today's summary within 2 taps (J7)
- repeat yesterday
- XP or streak feedback
- companion encouragement
- reminders
- offline logging (J5)

## Hard gates

A version that fails any gate can't win, whatever its score.

| Gate | Rule |
|---|---|
| noDataLoss | All 106 seeded meals exist after every journey run |
| wcagTextContrast | 0 failing text-contrast pairs |
| zeroRegressions | Both test suites pass |
| allJourneysSucceed | J1–J8 each succeed |

**Ties.** A total difference under 2 points is "no clear difference". A QUICK run is never a valid comparison.

## Results

| Category | Weight | A | B |
|---|---|---|---|
| Task speed and taps | 30 | 94 | 94 |
| Visual quality and accessibility | 20 | 19 | 83 |
| Performance | 15 | 52 | 68 |
| Maintainability | 15 | 75 | 74 |
| Regression safety | 10 | 100 | 100 |
| Habit-loop features | 10 | 100 | 100 |
| **Total** | 100 | **71** | **86** |

A fails the `wcagTextContrast` gate. B passes every gate. `TEST_REPORT_BENCH.md` records how the numbers were produced.
