# Phase 10 test report: verified challenges and anti-fraud

Date: 30 October 2026. Branch `codex/phase-4-camera-tracking`. Same machine and test schema as Phase 9.
Challenges ship **off** (`verified_challenges` flag).

## How a challenge works

A challenge is a metric, a target and 3–60 days in a time zone. Anyone with a feed profile can start up to 5 at a
time; community challenges need the community's owner or a moderator; private-community challenges are members only.
The creator takes part automatically. Reaching the target pays the `verified_challenge_completion` rule (40 XP) once
per challenge and unlocks the "Verified Challenge" badge. There is no leaderboard: people see their own progress and
how many took part and finished.

| Metric | What counts |
|---|---|
| Active days | Distinct days with a completed workout of 10+ minutes, a logged meal, or an event check-in |
| Workouts | Completed sessions of 10+ recorded minutes, at most 2 per day |
| Camera workouts | The same, camera-tracked only |
| Meal-logging days | Distinct days with a meal logged during the challenge |
| Events attended | Verified event check-ins (Phase 9) |

## Anti-fraud rules (all tested)

| Rule | Test |
|---|---|
| Progress is computed on the server; no endpoint accepts a number | Extra fields are ignored; XP can't be claimed from the client |
| Only records with server-set times inside the window count; a meal backdated into the window doesn't count | `test_backdated_meals_do_not_count_but_new_ones_do` |
| Workouts under 10 minutes don't count; at most 2 a day | `test_workouts_count_only_when_verified_and_capped_per_day` |
| Targets can't exceed what's countable (days, 2 workouts a day, 30 events) | `test_validation` |
| Leaving stops counting; rejoining is refused | `test_leaving_stops_counting_and_blocks_rejoining` |
| Upcoming challenges count nothing yet | `test_counts_are_shown_but_no_ranking…` |
| Large camera corrections flag the participation for review without blocking XP, and the flag is never shown or exported | `test_large_camera_corrections_flag_for_review_without_blocking` |
| XP once per challenge (ledger source `challenge:<id>`) | Repeated views pay 0 |

## Test counts

| Suite | Before | After |
|---|---|---|
| Backend pytest | 593 | **615 passed** (`test_challenges.py` 15) |
| Web vitest | 284 | **287 passed** (`challenges.test.tsx` 3) |
| TypeScript / ESLint | pass / 0 | **pass / 0 errors** |
| Browser `e2e-p10-challenges.mjs` (new) | — | **13/13** desktop + 360 px, CSP clean, axe clean |
| Other browser journeys (12) | pass | all pass; hardening intermittent when run after the others (KI-50) |

Migration 0011: dry run clean; enables the challenge rule and badge, downgrade disables them.

## Open items

- KI-48 (XP arrives on the next visit to the challenge), KI-49 (no moderator screen for flags), KI-50.
- Real people over a real week: NOT VERIFIED.
