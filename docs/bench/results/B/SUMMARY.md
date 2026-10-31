# Bench results: Version B

http://127.0.0.1:3008 · 5 runs · 2026-10-31T06:20Z

## Score: 86 / 100

| Category | Weight | Score |
|---|---|---|
| speed | 30 | 94 |
| visual | 20 | 83 |
| performance | 15 | 68 |
| maintainability | 15 | 74 |
| regression | 10 | 100 |
| habit | 10 | 100 |

## Hard gates

- noDataLoss: PASS
- wcagTextContrast: PASS
- zeroRegressions: PASS
- allJourneysSucceed: PASS

## Journeys (median of successful runs)

| Journey | Success | Taps | Keys | Seconds | Spread | Max interaction ms | Notes |
|---|---|---|---|---|---|---|---|
| J1 First run: sign up to first successful food log | 100% | 4 | 73 | 4.4 | 0.235 ⚠ | 56 |  |
| J2 Log a meal by search from the home screen | 100% | 4 | 4 | 3.82 | 0.068 | 56 |  |
| J3 Log a meal from favourites or recents | 100% | 3 | 0 | 2.49 | 0.35 ⚠ | 64 |  |
| J4 Barcode flow with manual fallback | 100% | 5 | 31 | 2.47 | 1.012 ⚠ | 52 | A logs barcode/manual meals to the device journal |
| J5 Log a glass of water | 100% | 3 | 0 | 2.24 | 0.122 | 40 | A keeps water in device storage |
| J6 Start a workout and log one set | 100% | 5 | 3 | 2.87 | 0.455 ⚠ | 64 |  |
| J7 Find today's progress summary | 100% | 2 | 0 | 1.29 | 0.649 ⚠ | 48 |  |
| J8 Change language or theme | 100% | 1 | 0 | 0.06 | 1.067 ⚠ | - | Theme: yes (footer Appearance). Language: A has a language preference in the plan but no translated interface, so changing language has no visible effect. |

## Lighthouse (mobile, median)

| Screen | Score | LCP ms | CLS | TBT ms |
|---|---|---|---|---|
| / | 82 | 4153 | 0 | 39 |
| /nutrition | 87 | 3626 | 0 | 55 |
| /workouts | 86 | 3702 | 0 | 86 |
| /play | 83 | 3932 | 0 | 104 |
| /progress | 91 | 2928 | 0 | 28 |
| /scanner | 88 | 3322 | 0 | 20 |
| /account | 89 | 3212 | 0 | 69 |

## API load (50 connections)

| Endpoint | p50 ms | p95 ms (≤) | Errors | 429 |
|---|---|---|---|---|
| /api/v1/auth/me | 244 | 418 | 0% | 0% |
| /api/v1/wellness/diary | 1680 | 2723 | 0% | 0% |
| /api/v1/adventure/summary | 2221 | 3893 | 0% | 0% |
| /api/v1/wellness/foods?q=rice | 1356 | 1686 | 0% | 0% |
| /api/v1/wellness/training | 4096 | 6376 | 0% | 0% |

## Screens, accessibility and tokens

- Screenshots: 337; unreachable: 0 (see screens.json)
- axe violations: 0 (0 serious/critical)
- Text contrast failures: 0 elements, 0 distinct colour pairs
- Distinct values: fontFamily 3, fontSize 15, fontWeight 11, lineHeight 59, color 100, backgroundColor 59, spacing 62, borderRadius 26, boxShadow 67, zIndex 8
- Keyboard traps: 0; 200% zoom horizontal scroll on 0 screens
- Animations still running with reduced motion: 0
- Hindi/Tamil: {"fontStack":"\"Geist Variable\", ui-sans-serif, system-ui, sans-serif, sans-serif","tamil":["Geist (web font)","Nirmala UI (system)"],"hindi":["Geist (web font)","Nirmala UI (system)"],"latin":["Geist (web font)"]}

## Code health

- App code: 250 files, 18131 lines; 6 files over 400 lines
- Duplication: 0.24911770811708533%
- Functions with complexity > 15: 46
- TypeScript any: 0, ts-ignore: 0
- Coverage: backend 89.5%, web 80.21%; tests backend 632 passed / 0 failed, web 331 / 0
- Add-a-field experiment: 6 app files + 2 tests

## Habit loop

- ✔ Quick re-log from favourites or recents (J3 succeeded)
- ✔ Today's summary within 2 taps (J7 taps median 2)
- ✔ Repeat yesterday ("Copy yesterday's meals" on the diary)
- ✔ Streaks / XP feedback (/play mentions XP or streaks)
- ✔ Companion encouragement (Home shows the companion)
- ✔ Reminders (/routine has reminders (push itself is behind a flag))
- ✔ Works offline for logging (Water and the journal are stored on the device (J5))
