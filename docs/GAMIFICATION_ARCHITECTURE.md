# Phase 1 gamification architecture

Implemented 28 October 2026. Scope: extend TrackCal, preserve existing records and six characters; no Phase 2 modules.

## Ownership and flow

Authenticated producer → validate its activity → lock the user → `services/gamification.award` → audit activity + legacy XP ledger → commit → authoritative summary → dashboard and shared companion. There is no public generic event-award endpoint. Opening a panel, changing cosmetics or following links never grants XP.

`adventure_profiles` is the existing gamification profile and owns the immutable journey IANA timezone. `reward_events` is the existing XP transaction ledger; both are reused rather than duplicated. Legacy rewards remain intact and feed achievements/streaks without awarding retroactive XP. Summary reads materialize earned achievements, character unlocks and default preferences, but do not create XP.

## Additive database migration

Version `20261028`: `backend/scripts/migrate_gamification.py` creates only missing tables and seeds only missing definitions. `backend/migrations/20261028_gamification_foundation.sql` documents equivalent table DDL; use the Python migration for indexes and seeds. Fresh installs use `bootstrap_schema.py`, which also seeds rules. Run the release job before starting this API version. No destructive migration or API-startup schema mutation.

New tables: `gamification_rules`, `activity_reward_events`, `achievements`, `user_achievements`, `character_customizations`, `character_unlocks`, `streak_records`. User-linked records have cascading foreign keys. Audit sources are unique per `(user_id, category, source_id)`; the ledger also retains unique `(user_id, reward_key)`. User/category audit lookups use the unique index and user index. Achievement and character ownership use composite primary keys.

The migration compares legacy users/profile/reward/meal counts before and after and was rerun successfully. Take a normal deployment backup; the count check assumes a quiet release window and is not a full backup checksum.

## Operational contracts

| Category | Validated producer | Source / eligibility |
|---|---|---|
| nutrition_log_completed | Explicit meal review | Owned immutable meal UUID, current local day, validated snapshot |
| nutrition_education_completed | Label Detective submit | Owned unexpired quiz session; server checks all answers |
| personal_plan_activity_completed | Existing meal solver | Feasible plan generation, once per local day; not proof meals were eaten |
| workout_completed | Explicit session review | Owned UUID, current journey day, named self-report, duration 1–180 minutes and bounded metrics |

The canonical future categories `exercise_skill_learned`, `community_contribution`, `verified_event_attendance`, `verified_challenge_completion`, `recovery_activity_completed` have disabled rules and definitions. They cannot earn XP through the engine even if an operator flips a rule: an implemented producer/allowlist change and tests are required. Food submissions are not moderated community achievements. Rest planning is not verified recovery exercise.

## Safety, privacy and retries

All producers authenticate, validate input, serialize on a user row lock and use current locking reads to avoid MySQL snapshot retry races. Rate limits, source uniqueness, per-kind daily uniqueness/caps and the global cap apply. Client XP is ignored by compatibility flows and rejected as an extra field by new workout/rest/settings schemas. No browser API can edit reward rules.

XP is participation history, not an editable food/exercise total. Correcting or deleting a local entry does not reverse participation already awarded; repeat reviews cannot mint another daily reward. Server-reviewed snapshots remain private in the account export. Account deactivation is not immediate erasure; new tables follow existing account retention policy, not a new erasure promise. No public leaderboard or automatic sharing. Workout completion is self-reported, not sensor/coach verified.

## Client integration

`JourneyCompanion` mounts once under `AccountSession`, remounts per user, fetches on initial mount/focus, accepts same-account summary updates after mutations, and uses server preferences. Dashboard and Play receive the same mutation notifications. The existing Play dock is suppressed while the shared companion exists. Native reduced-motion and the account-scoped calm preference disable movement; server preferences cover character/accessory, mute, minimize, disable, dock side and protection. No paid inference, microphone or camera access is used by this system.

Known scaling limit: summary scans an account's reward history and computes streaks in memory. Suitable for the present app, not benchmarked at multi-year large-scale workloads; future aggregation/pagination should preserve ledger semantics.
