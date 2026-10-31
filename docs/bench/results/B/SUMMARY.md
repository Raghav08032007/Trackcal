# Bench results: Version B

http://127.0.0.1:3008 · 5 runs · 2026-10-31T13:51Z

## Score: 88 / 100

| Category | Weight | Score |
|---|---|---|
| speed | 30 | 98 |
| visual | 20 | 86 |
| performance | 15 | 69 |
| maintainability | 15 | 73 |
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
| J1 First run: sign up to first successful food log | 100% | 4 | 73 | 4.54 | 0.274 ⚠ | 64 |  |
| J2 Log a meal by search from the home screen | 100% | 4 | 4 | 3.86 | 0.087 | 64 |  |
| J3 Log a meal from favourites or recents | 100% | 1 | 0 | 0.34 | 0.313 ⚠ | 32 |  |
| J4 Barcode flow with manual fallback | 100% | 5 | 31 | 2.54 | 0.521 ⚠ | 56 | A logs barcode/manual meals to the device journal |
| J5 Log a glass of water | 100% | 1 | 0 | 0.15 | 0.578 ⚠ | 48 | A keeps water in device storage |
| J6 Start a workout and log one set | 100% | 5 | 3 | 2.94 | 0.455 ⚠ | 72 |  |
| J7 Find today's progress summary | 100% | 2 | 0 | 1.3 | 0.424 ⚠ | 40 |  |
| J8 Change language or theme | 100% | 1 | 0 | 0.06 | 0.809 ⚠ | - | Theme: yes (footer Appearance). Language: A has a language preference in the plan but no translated interface, so changing language has no visible effect. |

## Lighthouse (mobile, median)

| Screen | Score | LCP ms | CLS | TBT ms |
|---|---|---|---|---|
| / | 83 | 4140 | 0 | 34 |
| /nutrition | 86 | 3626 | 0 | 25 |
| /workouts | 86 | 3692 | 0 | 67 |
| /play | 85 | 3816 | 0 | 88 |
| /progress | 91 | 2930 | 0 | 17 |
| /scanner | 88 | 3308 | 0 | 22 |
| /account | 90 | 3194 | 0 | 57 |

## API load (50 connections)

| Endpoint | p50 ms | p95 ms (≤) | Errors | 429 |
|---|---|---|---|---|
| /api/v1/auth/me | 153 | 185 | 0% | 0% |
| /api/v1/wellness/diary | 1357 | 1894 | 0% | 0% |
| /api/v1/adventure/summary | 1977 | 2896 | 0% | 0% |
| /api/v1/wellness/foods?q=rice | 828 | 895 | 0% | 0% |
| /api/v1/wellness/training | 2710 | 4263 | 0% | 0% |

## Screens, accessibility and tokens

- Screenshots: 337; unreachable: 0 (see screens.json)
- axe violations: 0 (0 serious/critical)
- Text contrast failures: 0 elements, 0 distinct colour pairs
- Distinct values: fontFamily 3, fontSize 15, fontWeight 11, lineHeight 59, color 100, backgroundColor 59, spacing 62, borderRadius 26, boxShadow 69, zIndex 8
- Keyboard traps: 0; 200% zoom horizontal scroll on 0 screens
- Animations still running with reduced motion: 0
- Hindi/Tamil: {"fontStack":"\"Geist Variable\", ui-sans-serif, system-ui, sans-serif, sans-serif","tamil":["Geist (web font)","Nirmala UI (system)"],"hindi":["Geist (web font)","Nirmala UI (system)"],"latin":["Geist (web font)"]}

## Code health

- App code: 254 files, 18415 lines; 6 files over 400 lines
- Duplication: 0.24443237370994023%
- Functions with complexity > 15: 48
- TypeScript any: 0, ts-ignore: 0
- Coverage: backend 89.7%, web 80.67%; tests backend 663 passed / 0 failed, web 341 / 0
- Add-a-field experiment: 6 app files + 2 tests

## Habit loop

- ✔ Quick re-log from favourites or recents (J3 succeeded)
- ✔ Today's summary within 2 taps (J7 taps median 2)
- ✔ Repeat yesterday ("Copy yesterday's meals" on the diary)
- ✔ Streaks / XP feedback (/play mentions XP or streaks)
- ✔ Companion encouragement (Home shows the companion)
- ✔ Reminders (/routine has reminders (push itself is behind a flag))
- ✔ Works offline for logging (Water and the journal are stored on the device (J5))
