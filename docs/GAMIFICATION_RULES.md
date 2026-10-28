# Phase 1 gamification rules

28 October 2026. Backend configuration is authoritative. Operators edit `gamification_rules` in a controlled release and increment its version; seeds never overwrite configured rows. Do not edit historical transactions to change current pricing of activities.

| Activity | XP | Daily kind cap |
|---|---:|---:|
| Explicit nutrition review | 10 | 10 |
| Correct completed nutrition quiz | 10 | 10 |
| Feasible personal meal plan | 10 | 10 |
| Explicit reviewed workout self-report | 20 | 20 |
| Three reviewed meal days in a week | 25 | 25, once per week |
| Planned rest day | 0 | No XP |

Global daily XP cap: 75. The compatibility daily reward key also means one paid reward per category/day. Rule/cap increases do not reopen an already rewarded day. Repeated UUIDs are idempotent; multiple workout UUIDs never reward volume. Defaults preserve prior quest values; addendum values were examples rather than mandatory replacements.

Level = `1 + floor(total XP / level_step)`, level XP = `total XP mod level_step`; default `level_step=250`. Pip/Nova/Milo/Luna/Rio/Sage unlock at levels 1/2/3/4/5/6. Persisted character unlocks are retained. Accessories: flower at 2, crown at 5, sun at 10. Accessories are cosmetic, never health status or verified badges. Changing the formula can change displayed levels; use a deliberate release policy.

## Achievements

First Activity: 1 qualifying rewarded activity. First Workout: 1 rewarded workout. Consistency Milestone: engagement on 3 distinct local days. Recovery Awareness: 1 explicitly planned rest day (awareness only). Skill Builder (3 skills), Community Contributor (1 contribution), Verified Event and Verified Challenge are locked/disabled until their actual verification modules ship. Achievements have locked/in-progress/unlocked states and earned achievements persist. They are never sold.

## Flexible engagement

Qualifying days derive from positive meal, quiz, plan or workout ledger entries, including existing history. Weekly bonus alone does not count. A single appropriate activity is enough; daily exercise and all-three quests are not required. Existing stricter task/meal streaks remain available separately.

Use the profile's IANA timezone for days, including DST; clients cannot backdate rewards or change the established timezone. Default planned rest allowance is 2 per Monday–Sunday local week. Rest can be recorded only for today, idempotently, without XP. Rest extends an existing engagement run; rest alone cannot create a run. When a day is both active and rest, active takes precedence.

Default optional protection bridges 1 missed day per local week while a run is active and the latest engaged day is at most 3 days earlier. It is not a paid consumable. Today is still open until an activity/rest is recorded; otherwise the current calculation ends yesterday. Streak length includes accommodated rest/protection days, while distinct activity metrics do not. History exposes engaged/rest/protected/missed for the last 35 days. Protection changes recompute history; they never remove earned XP, achievements or character unlocks. Taking a longer break can reset the displayed current run, with neutral encouragement and no XP penalty.

No XP from body weight, BMI, calories restricted, measurements, extra water, extreme workout duration or eating a prescribed amount. No health claims are inferred from levels.

Configuration note: disabling a reward for an operational module returns zero XP without blocking the underlying activity. Quest XP labels reflect configured rule values. Future module flags alone never make an unimplemented producer operational.

## Phase 2 centralized rewards — 28 October 2026

| Server kind | Default XP / daily kind cap | Duplicate policy |
|---|---|---|
| onboarding | 10 / 10 | Once per account, after final saved completion |
| activity_plan | 10 / 10 | First valid saved personal activity plan only; regeneration never reawards |
| planner_learning | 10 / 10 | Once per account for the server-scored planner lesson |
| fitness_learning | 10 / 10 | Once per account for the approved application fitness lesson |
| nutrition_learning | 10 / 10 | Once per account for the personal nutrition lesson |
| workout | Existing 20 / 20 | Planned and manually reviewed workouts share the same daily reward key/cap |
| recovery | 5 / 5 | Explicit completion of a planned recovery activity; once per reward day |

The global cap remains 75. Immutable activity IDs and lifetime keys feed the existing activity audit/XP ledger. Initializing/revisiting onboarding, entering measurements, editing preferences, regenerating plans, snoozing reminders and opening pages never award extra XP. A valid plan requires eligible activity/rest entries; an empty blocked schedule cannot earn the first-plan reward.

New persistent achievements: Personal Journey Started, First Plan Created and Fitness Explorer. Onboarding/plan/fitness-lesson completion audits can establish those achievements even if the global XP cap leaves zero available points. Flexible engagement also recognizes positive Phase 2 rewarded activities; historical rest accommodation and prior strict task streaks remain intact.

The basic fitness education and planned self-reported recovery producers are now operational. This supersedes Phase 1's disabled placeholders for those specific categories. Multi-skill Skill Builder, moderated community, verified events and verified challenges remain disabled. A recovery completion is participation, not verified treatment or a medical outcome; declaring a Phase 1 rest day still grants zero XP.

## Phase 3 participation extensions

First reusable meal: server kind saved_meal, default 10 XP/day cap 10, a lifetime account key means creation/regeneration/deletion cannot repeat the first-time award. Food Explorer requires its valid audit event. Favorite toggles are zero XP.

Cloud diary confirmation uses existing meal 10/day and weekly-consistency rules. Corrections, deletion, old-date entries and retry IDs do not reaward. Optional unknown nutrients do not become zero and nutrition amounts never affect rewards.

Completed sessions use existing workout 20/day or recovery 5/day rules. Manual reviews, personalized-plan completion and detailed sessions share the same ledger/category/cap, with a linked plan's activity ID reused. Extra sets, duration or resistance do not earn additional XP. All values remain database-configurable under the existing global 75/day cap.

Wellness Learner: three distinct existing approved education completions. Recovery Champion: three rewarded recovery participations (at most one paid reward per reward day). Skill Builder, community/event/challenge verification remain disabled until actual verification modules support them. New first-time audits can unlock their participation badges even when the daily XP allowance is exhausted; no badge is sold.


## Phase 4 camera participation

Camera-confirmed sessions reuse the existing `workout` kind (default 20 XP / 20 daily cap), global 75 cap and plan-activity/session source ID. Completing a camera and manual workout on the same local day cannot increase that category reward. Completion retries and history amendments grant zero additional XP. No reward for raw counts, sets, duration, visibility confidence, body shape, weight or appearance.

The central completion audit carries only tracking_method/exercise for eligible camera participation. Three new persistent definitions derive from those real completion audits: First Camera Workout (one confirmed session), Movement Explorer (three distinct supported camera exercise types), Tracking Milestone (three distinct local days). Audits can establish participation even when daily XP is already capped. They are not sensor-attested skill, form, medical safety or competitive ranking. No separate XP endpoint/system, new paid award or confidence leaderboard.
