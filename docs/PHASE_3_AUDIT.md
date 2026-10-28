# Phase 3 audit and baseline

28 October 2026. Branch: codex/phase-3-nutrition-workouts in root and embedded frontend repositories. Read existing Phase 0 visual, Phase 1 reward/companion and Phase 2 personalization documentation. Prior functionality preserved.

Baseline: 219 backend tests and 181 frontend tests across 32 files pass. No application baseline failures. Existing actual schema inspected before model changes.

Fully implemented foundations: authentication/profile isolation, optional measurements, personalized plans, central XP, badges/streaks, shared companion, local nutrition journal, barcode preview/upload/manual lookup and reviewed meal estimates. Existing foods, food_nutrients, food_translations, custom_foods, meal_logs, meal_items, saved_meals, plan_activities and reward tables are reusable.

Partial: server diary APIs lack the advanced cloud UI/edit/save workflows; food search lacks regional aliases/pagination and favorites; workouts support local records and planned completion but not detailed persistent session state/sets. Scanner consent/correction/deletion UX needs improvement. Missing: owned favorites/search history, saved workout blueprints and detailed MySQL sessions. No broken prerequisite was identified by baseline testing.

Design: add cloud nutrition and workout screens linked to existing tools, preserving the existing device journal and local workouts. Label storage boundaries honestly rather than silently merging or importing private device records. Reuse saved_meals and canonical meal tables; do not create duplicate diary/XP tables. Add only missing source-alias/favorite/history/session/blueprint storage. Workout sets can be bounded JSON snapshots saved transactionally, rather than unnecessary duplicate history tables.

Global requirement: readable larger typography, minimum touch sizes, responsive cards, immediate feedback, optional CSS character movement/celebration, quiet notifications and no random/shame/volume-based rewards. Scanner defaults to private local preview/manual correction; existing inference remains explicit opt-in, not a new paid provider.

Phase 4 is out of scope. Testing: full prior regression, isolated transactional integration tests, synthetic-account browser flows and measured query/runtime checks. A real physical-device or recognition-accuracy certification will not be invented.
