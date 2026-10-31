# Bench harness test report

Date: 2026-10-30. Branch: `bakeoff/measure`. Version A commits: root `25f99f3c`, web `9eefb07` (both tagged `legacy-baseline`).

**Overall: PASS WITH LIMITATIONS.** The harness works, and Version A is measured from the frozen tags. Version A itself scores 71/100 and fails one hard gate (text contrast).

## Version A result

| Category | Weight | Score |
|---|---|---|
| Task speed and taps | 30 | 94 |
| Visual quality and accessibility | 20 | 19 |
| Performance | 15 | 52 |
| Maintainability | 15 | 75 |
| Regression safety | 10 | 100 |
| Habit-loop features | 10 | 100 |
| **Total** | 100 | **71** |

| Hard gate | Result |
|---|---|
| noDataLoss | PASS (10 of 10 checks: all 106 seeded meals present) |
| wcagTextContrast | **FAIL** (20 colour pairs, 190 elements; a later fix found the check skipped `oklch` colours, so this was an undercount until re-measured) |
| zeroRegressions | PASS (573 backend, 278 web) |
| allJourneysSucceed | PASS (80 of 80 runs) |

Full numbers are in `results/A/SUMMARY.md`, and the pinned commits are in `results/A/provenance.json`.

## Checks

| Item | Result | Evidence |
|---|---|---|
| Freeze: tag `legacy-baseline` | PASS | Tag exists in both repos |
| Freeze: no app code changed by the harness | PASS | Only `tools/bench/`, `docs/bench/` and `Makefile` were added |
| Freeze: branch stays frozen | **FAIL** | Another session committed app work to `bakeoff/measure` from 10:11 (see Incident) |
| Journeys J1–J8 | PASS | 8 journeys × 2 devices × 5 runs, all checked against stored data |
| Screens | PASS | 232 screen captures and 84 state captures, 0 unreachable. 4 devices, 2 themes |
| Journey network conditions | NOT VERIFIED | Journeys ran on the normal network only. Slow 4G with 4× CPU was applied to Lighthouse and the loading state |
| Journey devices | PASS WITH LIMITATIONS | Journeys ran on 2 of the 4 devices (360 and 1280). Screens ran on all 4 |
| Lighthouse | PASS WITH LIMITATIONS | 7 screens × 5 valid runs. 1 run hit a Lighthouse trace error and was retried. INP isn't measured |
| Load test | PASS WITH LIMITATIONS | Waitress on Windows, not production's gunicorn on Linux. Food search used 200 fixed requests per run because of its rate limit. The p95 column is p97.5, an upper bound |
| Tokens, contrast, tap targets | PASS | 116 page audits |
| Accessibility | PASS | axe on 58 pages, keyboard and 200% zoom on 29 screens, reduced motion |
| Code health | PASS | All tools ran. The dependency check reuses the Phase 6 OSV scan and did not rerun it |
| Scorecard and `bench-compare` | PASS | A vs A gives identical scores; a missing label fails with exit 1 |
| `make` targets | NOT VERIFIED | `make` isn't installed here, so the same node commands were run directly |
| Usability kit | PASS WITH LIMITATIONS | Written and the SUS example is checked. Not yet used with participants |

## Failure drills

| Drill | Expected | Result |
|---|---|---|
| App is down | Stops before measuring, exit 1 | PASS: `results/drills/app-down.txt` |
| Seed against a non-test database | Refused, exit 1 | PASS: `results/drills/seed-refused.txt` |
| Deliberately broken journey | Reported as FAILED with the reason, exit 1 | PASS: `results/drills/broken-journey-J3.json` |
| Two runs agree | Same counts; timings within 15% | PASS WITH LIMITATIONS: taps and keystrokes identical; 12 of 16 timings within 15%, median difference 8.5%. `results/drills/repeat-runs.json` |
| Version A measured away from the tag | Refused, exit 1 | PASS (added after the incident) |
| Code under test changes during a run | Run fails | PASS: fired on a real case, a coverage file written into the checkout |

## Incident: first full run discarded

The first full run (about 10:25 to 11:46) was invalid. Another session was committing to `bakeoff/measure` during it and rebuilt `frontend/web/dist` at 11:21. The results were discarded, and everything in this report comes from the rerun.

Changes made so it can't recur:
- Version A runs from separate worktrees pinned to `legacy-baseline`.
- `bench.mjs` refuses the wrong commit and fails if the code changes during a run.

**Change outside the bench files:** the other session's unfinished migration `0012` left `character_customizations.aura` and `title` in `trackcal_phase3_test` as NOT NULL with no default, which broke Version A. Both columns were given defaults (`'none'` and `''`). This applies to that test database only.

## Harness bugs found and fixed

- Failed backend tests were counted as 0, because pytest prints failures first. The count is fixed, and a non-zero exit now fails the gate.
- Load-test errors were double-counted, and the Flask development server produced false connection errors.
- Lighthouse trace errors scored 0 and were averaged in. They are now retried and excluded, with a fresh Chrome for every run.
- Journey spread pooled phone and desktop. It is now judged per device.
- A journey file with a syntax error silently fell back to Version A's journeys.

## Limitations

- **Timing noise**: 7 of 8 journeys are flagged over 15% spread on at least one device. Most are 1–4 second lab runs, so small time differences between versions are noise. Taps and keystrokes are exact.
- **Clock**: only the browser clock is fixed; the server clock is real.
- **Database**: `trackcal_phase3_test` also holds tables from later work, because the app's database user can't create another database. Version A's code ignores them.
- **Screenshots**: 345 PNG files (296 MB) stay on disk and are git-ignored. The JSON results are committed.

## Version A findings

These are recorded only: app code is frozen.

1. **Text contrast fails the gate.** 166 of the 190 failing elements are in dark theme. "Send feedback" is unreadable there (1.09:1). axe finds serious colour-contrast issues in light theme on 5 screens: barcode, food library, journal, progress and tools.
2. **Speed on slow 4G.** LCP is about 10.8 s on 6 main screens and 33 s on `/play`, well over the 2.5 s target.
3. **API under load.** At 50 connections, p95 is 1.7–3.0 s on 4 of 5 endpoints.
4. **Food search race.** An `IntegrityError` caused occasional 500s under concurrent load, seen in quick runs but not in the 5 full runs.
5. **Outage looks like sign-out.** When the session check itself fails, `/nutrition` asks a signed-in person to sign in. Correction: the `error` screenshot was not evidence of this. That capture lets the session check through, and its 60-minute session had most likely expired by then. The bug was confirmed separately by reading the code and testing a full outage. The bench now logs in again before this pass and has a separate `outage` state.
6. **Visual sprawl.** 89 font sizes, 93 text colours and 89 spacing values, so the tokens criterion scores 0.
7. **Tamil and Hindi.** These use the system font, not the brand font.
8. **Language.** Version A has no translated interface, so J8 measures theme only.
9. **Complexity.** 43 functions are over complexity 15, and `food-workspace.tsx` has 1,667 lines.

## Version B comparison (31 October 2026)

**Result: B 86, A 71. B wins and is the only version that passes every hard gate.** Full table: `results/COMPARE-A-vs-B.md`.

Measured commits: A `25f99f3c` / `9eefb07`, B `884490bd` / `0183d97`, both from pinned checkouts. Later commits (challenge and event fixes, reporting, event alerts, companion bond) are not in this measurement.

| Measure | A | B |
|---|---|---|
| Failing contrast pairs | 21 | 0 |
| axe serious violations | 10 | 0 |
| Largest contentful paint on slow 4G | 10.7–33.3 s | 2.9–4.2 s |
| Lighthouse | 64–72 | 82–91 |
| Font sizes | 89 | 15 |
| Text colours | 93 | 100 |
| Controls under 44 px, per page | 9.2 | 11.5 |
| Functions over complexity 15 | 43 | 46 |
| Journey taps | same | same |

**How it was run.** A's screens were re-measured with the fixed colour parser, and both versions' Lighthouse and load tests were re-run back to back on an otherwise idle machine. The first B load test was discarded from the comparison because a short test run overlapped it.

**API under load.** `/wellness/training` p95 was the same on both (6.4 s), so it is not a B regression, though it is slow. It was 3.0 s in A's earlier run, so this endpoint varies a lot between runs. B was slower on `/wellness/diary` (2.7 s vs 1.7 s), `/adventure/summary` (3.9 s vs 2.3 s) and `/auth/me` (0.42 s vs 0.31 s). Spreads were 18–41% on B and 15–46% on A, so these differences are not proven. Neither endpoint met the 300 ms target.

**Where B is worse:** more undersized controls, 7 more text colours, 3 more complex functions. Maintainability fell by 1 point.

**Limits.** Taps did not change, so the speed score did not either. Seconds are lab speed with high spread. Contrast skips text on gradients. No real people have used B, so the usability kit is still needed.
