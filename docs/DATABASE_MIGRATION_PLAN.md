# Proposed database migration plan

28 October 2026. Planning only. No migration, schema write, table deletion or live data rewrite was executed in this visual pass.

Keep existing users/profiles/settings/consents, workspace snapshots, coach slots/bookings and adventure ledger/session tables. Inspect actual deployed schema and data volumes before writing migrations; ORM classes alone are not deployed-schema evidence.

Proposed additive groups, with explicit ownership and indexed foreign keys:

- Preferences: experience, interests, availability and feedback; optional private measurements with consent/retention metadata.
- Workouts: programs, exercises, sessions and user-reviewed sets; optional pose summary/version/confidence, no default raw camera video storage.
- Social: posts (text/compressed image reference), visibility, follows, reactions, blocks/reports and moderation actions.
- Communities: groups, memberships, scoped roles and activity links.
- Events: verified organizers, events, registrations, expiring attendance tokens and unique attendance claims. Avoid storing continuous location trails.
- Challenges: versioned rules, enrollment, evidence reference and idempotent completion claims.
- Companion settings: minimized/disabled/muted/motion/dock preferences; server reward truth stays in the existing ledger.
- Billing: provider customer/subscription identities, unique webhook events, entitlement grants and reconciliation records. Avoid storing card details.

Migration workflow: backup plus proven restoration → additive tables/indexes → deploy code that tolerates old state → bounded backfill with dry-run/counts → verify ownership and counts → switch feature flag. Document rollback and retention for every group. Never drop legacy tables merely because a module is replaced. Enforce idempotency for attendance, rewards and provider events. Test account deletion/deactivation and export implications before rollout.
