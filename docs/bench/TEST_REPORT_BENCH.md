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
| wcagTextContrast | **FAIL** (20 colour pairs, 190 elements) |
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
5. **Outage looks like sign-out.** When the API returns 503, `/nutrition` asks a signed-in person to sign in.
6. **Visual sprawl.** 89 font sizes, 93 text colours and 89 spacing values, so the tokens criterion scores 0.
7. **Tamil and Hindi.** These use the system font, not the brand font.
8. **Language.** Version A has no translated interface, so J8 measures theme only.
9. **Complexity.** 43 functions are over complexity 15, and `food-workspace.tsx` has 1,667 lines.
