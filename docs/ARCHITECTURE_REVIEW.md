# Architecture review and target modules

28 October 2026. Preserve the modular monolith: Next.js browser/server boundary → FastAPI routers/services → MySQL, with isolated optional CPU workers for OCR/speech. Do not create microservices for every planned feature.

## Boundaries

Auth/consent and private profiles underpin nutrition, workouts, participation, coaching and future social/event modules. Keep nutrition records and private measurements private by default. Social publication must be a separate explicit write, never an automatic consequence of a logged meal or completed quest. Server roles/ownership must protect every read/write; client visibility is not authorization.

Reuse existing journal validation, upload limits, revision checks, request timeouts, rate buckets, role-based booking and idempotent reward ledger. Avoid duplicating XP in local storage. Reuse support APIs after removing unsupported service-response promises and completing actual operator processes.

## Planned integration dependencies

- Personalization: preferences, interests, experience, availability, feedback; rule-based plan selection first. Optional height/weight; calculator assumptions require review and consent.
- Workouts: curated exercise data and manual logging first; MediaPipe runs on-device only after camera consent. Rep estimates must report limitations and confidence, not claim form diagnosis.
- Social: compressed images/text, pagination, object storage, ownership, reporting/blocking and moderation before public release. No initial video/live streaming.
- Communities: memberships/roles and moderation use social identity but do not expose private nutrition by default.
- Events: organizer verification, coarse discovery, explicit attendance verification and expiring signed QR tokens. GPS is fallible; no continuous tracking.
- Challenges: explicit rule versions and verification source; repeat/replay limits; distinguish manual participation from verified attendance.
- Coaching: existing booking plus consented client relationships/programs before multi-client dashboards.
- Billing: one provider adapter with signed/idempotent webhooks, entitlements, quotas and reconciliation; private account data is not a monetization source.

## Main risks

Parallel local/cloud storage can confuse users; show last-sync/conflict states. The embedded frontend Git checkout needs deliberate source packaging/publication. Optional local services cannot be implied to be hosted. A growing globals.css and duplicated companion logic need a planned token/component consolidation, not an unrelated rewrite in this visual pass. Deployment, nutrition accuracy and security require evidence beyond passing unit tests.
