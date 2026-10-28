# TrackCal 4.0 phased implementation

28 October 2026. The explicit current chat authorizes visual 3D-style refinement only. Future modules below remain proposals; do not interpret this plan as approval to deploy, publish data or begin a separate product expansion.

## Phase 0 — audit and bounded visual refinement

Preserve characters/data, document current state and target architecture, improve existing surface depth/touch feedback, verify web tests/build/lint and inspect the rendered pages. No new database tables or external dependencies. The read-only portion is architecture/schema/product analysis; the visual exception comes from the current chat request.

## Phase 1 — shared foundations (requires user approval)

Consolidate design tokens/components, shared authenticated companion layout, settings, accessible navigation/loading/empty states and clear sync status. Consent/privacy boundaries and optional measurements first. Acceptance: account isolation, full keyboard/390 px operation, no camera regression or involuntary data sharing.

## Phase 2 — reliable daily routines

Customizable quests, rest-day support, weekly reflection, quote library and quiet-hour reminders. Preserve nutrition as reviewable references rather than a competition. Measure activation and repeated use with consenting pilot users.

## Phase 3 — workouts and on-device camera

Manual programs/session recording first, then opt-in pose estimation with explicit limitations. Test real devices, camera release, low confidence, accessibility alternatives and interrupted streams. Do not upload exercise video by default.

## Phase 4 — social and communities

Text/compressed-image posts, visibility, blocks/reports, moderation and groups. Ship no public feed until ownership, abuse handling, retention and consent are verified.

## Phase 5 — verified events/challenges

Organizer workflows, registrations, coarse discovery, expiring QR attendance and replay-resistant challenge evidence. Location alone does not prove attendance. Provide alternatives to GPS.

## Phase 6 — coaching and paid operations

Consent-based multi-client programs, then checkout/webhooks/entitlements/cancellation/reconciliation. Complete HTTPS/domain, real email, monitoring, load/recovery/security and operator training before charging customers.

## Release evidence

For every phase: server ownership/role tests, duplicate/concurrency tests where needed, accessible browser tests, user data export/retention review, external-provider failure tests and explicit implemented/partial/missing status. Unit tests do not substitute for physical-device or food-estimation accuracy evaluation. Keep the existing 168-test backend verification as historical evidence until a new backend run is performed. Record the new visual pass's web/build/runtime results separately.

## Ongoing limitations register

Track limitations from completed and future phases in [LIMITATIONS_REGISTER.md](LIMITATIONS_REGISTER.md). Review and rectify the remaining backlog after the approved phases are complete; launch gates still apply before public release. Phase 1 gamification was subsequently approved and completed: see PHASE_TEST_REPORT.md. The Phase 1 approval requirement and 168-test baseline above are historical planning context, superseded by the dated Phase 1 handoff. No Phase 2 approval is implied by recording this backlog.

## Phase 2 brief delivered

The user-supplied Phase 2 personalization brief superseded the earlier proposed Phase 2 scope above. Its implementation/evidence are in PHASE_2_IMPLEMENTATION.md and PHASE_TEST_REPORT.md. Do not infer that earlier unimplemented quote-library/social/exercise-camera proposals have shipped. Phase 3 still requires a new approval.

## Phase 3 actual brief delivered

The user-supplied advanced nutrition/workout-session brief superseded the earlier proposed exercise-camera Phase 3 scope. See PHASE_3_IMPLEMENTATION.md and PHASE_TEST_REPORT.md. Pose/rep-camera verification is not silently treated as shipped. Global typography/motion/positive-engagement gates are in GLOBAL_UX_REQUIREMENTS.md. Phase 4 requires separate approval.


## Approved Phase 4 camera scope

The user's Phase 4 brief supersedes earlier social/community phase ordering only for this implementation. Camera tracking extends Phase 3 sessions and the same companion/reward engine. Current evidence and unresolved device/accuracy gates are in PHASE_TEST_REPORT.md and LIMITATIONS_REGISTER.md (P4-02–P4-11); the historical P4-01 social constraint remains retained. Phase 5 requires new approval and has not started.
