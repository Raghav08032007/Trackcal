# Workout session architecture

28 October 2026. `/workouts` extends existing manual workouts and personalized plans. It is not a sensor-verified or clinical exercise product.

## Reviewed library and saved workouts

Reuse Phase 2 curated template IDs/instructions and review metadata. Expose searchable categories, movement patterns, equipment, difficulty, safety, accessibility and alternatives. No unlicensed demo media or invented technique is displayed. Favorites/saved blueprints contain reviewed IDs, not arbitrary unreviewed instructions. Professional restrictions, accessibility/equipment and pain feedback remain eligibility gates; recovery is available. Generic sport interest is not sport-specific coaching.

## Sessions and integrity

A client UUID identifies a session. Server states: active, paused, completed, abandoned. Only one active/paused session per account. Owned JSON snapshots hold at most 10 exercises and 20 sets per exercise; bounds enforce reps 0–100, resistance 0–500 kg and set duration 0–60 min. These are storage limits, not prescriptions. Recorded session duration is 0–180 min for drafts and at least 1 min for explicit completion. Notes are bounded/private.

Start, save, pause/resume, replace, end incomplete, complete, correct history and delete have distinct feedback. Revision checks reject stale updates. In-flight editor controls lock so response snapshots cannot overwrite new keystrokes. Account-scoped local drafts persist each change and survive failed requests; before-unload warnings protect active unsynced edits. Opening another session cannot silently overwrite a pending draft. Explicit save/pause/completion synchronizes to the account; cold-start authenticated offline is not guaranteed.

Server clock tracks active elapsed seconds across pauses (bounded at 180 min); recorded minutes are an explicit self-report and are not calorie-burn estimates. The optional 30-second rest timer is client-only, silent, stoppable and has no reward. Rest may be longer than the timer.

A unique optional plan_activity_id prevents duplicate linked sessions. Linked sessions require the owned active plan, today's schedule and the current approved template; completion updates the existing plan activity in the same transaction. Planned and manual/session completion share the central workout/recovery category and source ID. The Phase 2 direct-complete path therefore cannot award a second reward. Completed-session retries return zero XP. Other stale retries return a recoverable revision conflict. Completed history corrections change sets/duration/notes without rewriting exercise identity or awarding XP again.

Deleting a session hides it without deleting earned participation. Removing an incomplete linked session releases its plan link for a later retry; completed participation history remains protected. Abandoned sessions stay in history and can resume when their plan/eligibility is still valid. Archived/outdated linked plans require review/end-incomplete rather than silently bypassing the plan's constraints.

## History and summaries

Paginated account history, recent sessions, seven-local-day completion calendar and recorded-duration totals derive from actual non-deleted records. Shared learning/participation badges are displayed; multi-skill verification is not invented. There are no body rankings, extra-volume rewards or XP-based intensity progression. Existing device-only workout records remain accessible under local tools and are not silently imported.

See PHASE_TEST_REPORT.md for duplicate/concurrency/ownership/regression evidence and LIMITATIONS_REGISTER.md for unsupported devices, portability, retention, history bounds and production-scale validation.
