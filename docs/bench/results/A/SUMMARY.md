# Bench results: Version A

http://127.0.0.1:3007 · 5 runs · 2026-10-31T14:05Z

## Score: 71 / 100

| Category | Weight | Score |
|---|---|---|
| speed | 30 | 94 |
| visual | 20 | 19 |
| performance | 15 | 49 |
| maintainability | 15 | 75 |
| regression | 10 | 100 |
| habit | 10 | 100 |

## Hard gates

- noDataLoss: PASS
- wcagTextContrast: **FAIL**
- zeroRegressions: PASS
- allJourneysSucceed: PASS

## Journeys (median of successful runs)

| Journey | Success | Taps | Keys | Seconds | Spread | Max interaction ms | Notes |
|---|---|---|---|---|---|---|---|
| J1 First run: sign up to first successful food log | 100% | 4 | 73 | 4.09 | 0.175 ⚠ | 48 |  |
| J2 Log a meal by search from the home screen | 100% | 4 | 4 | 3.1 | 0.251 ⚠ | 40 |  |
| J3 Log a meal from favourites or recents | 100% | 3 | 0 | 2.23 | 0.412 ⚠ | 40 |  |
| J4 Barcode flow with manual fallback | 100% | 5 | 31 | 2.93 | 0.655 ⚠ | 40 | A logs barcode/manual meals to the device journal |
| J5 Log a glass of water | 100% | 3 | 0 | 2.1 | 0.079 | 32 | A keeps water in device storage |
| J6 Start a workout and log one set | 100% | 5 | 3 | 2.27 | 0.662 ⚠ | 48 |  |
| J7 Find today's progress summary | 100% | 2 | 0 | 0.97 | 0.374 ⚠ | 36 |  |
| J8 Change language or theme | 100% | 1 | 0 | 0.06 | 0.45 ⚠ | - | Theme: yes (footer Appearance). Language: A has a language preference in the plan but no translated interface, so changing language has no visible effect. |

## Lighthouse (mobile, median)

| Screen | Score | LCP ms | CLS | TBT ms |
|---|---|---|---|---|
| / | 64 | 10788 | 0.17 | 2 |
| /nutrition | 68 | 10813 | 0.13 | 27 |
| /workouts | 72 | 10888 | 0.06 | 17 |
| /play | 66 | 33387 | 0.14 | 17 |
| /progress | 72 | 10672 | 0.04 | 9 |
| /scanner | 67 | 10972 | 0.13 | 13 |
| /account | 67 | 10814 | 0.14 | 10 |

## API load (50 connections)

| Endpoint | p50 ms | p95 ms (≤) | Errors | 429 |
|---|---|---|---|---|
| /api/v1/auth/me | 289 | 353 | 0% | 0% |
| /api/v1/wellness/diary | 1859 | 3032 | 0% | 0% |
| /api/v1/adventure/summary | 2648 | 4422 | 0% | 0% |
| /api/v1/wellness/foods?q=rice | 1570 | 1910 | 0% | 0% |
| /api/v1/wellness/training | 5967 | 9604 | 10% | 0% |

## Screens, accessibility and tokens

- Screenshots: 337; unreachable: 0 (see screens.json)
- axe violations: 10 (10 serious/critical)
- Text contrast failures: 200 elements, 21 distinct colour pairs
- Distinct values: fontFamily 3, fontSize 89, fontWeight 11, lineHeight 139, color 93, backgroundColor 59, spacing 89, borderRadius 30, boxShadow 65, zIndex 8
- Keyboard traps: 0; 200% zoom horizontal scroll on 0 screens
- Animations still running with reduced motion: 0
- Hindi/Tamil: {"fontStack":"\"Geist Variable\", ui-sans-serif, system-ui, sans-serif, sans-serif","tamil":["Geist (web font)","Nirmala UI (system)"],"hindi":["Geist (web font)","Nirmala UI (system)"],"latin":["Geist (web font)"]}

## Code health

- App code: 229 files, 16441 lines; 6 files over 400 lines
- Duplication: 0.19456767063584715%
- Functions with complexity > 15: 43
- TypeScript any: 0, ts-ignore: 0
- Coverage: backend 88.9%, web 80.59%; tests backend 573 passed / 0 failed, web 278 / 0
- Add-a-field experiment: 6 app files + 2 tests

## Habit loop

- ✔ Quick re-log from favourites or recents (J3 succeeded)
- ✔ Today's summary within 2 taps (J7 taps median 2)
- ✔ Repeat yesterday ("Copy yesterday's meals" on the diary)
- ✔ Streaks / XP feedback (/play mentions XP or streaks)
- ✔ Companion encouragement (Home shows the companion)
- ✔ Reminders (/routine has reminders (push itself is behind a flag))
- ✔ Works offline for logging (Water and the journal are stored on the device (J5))
