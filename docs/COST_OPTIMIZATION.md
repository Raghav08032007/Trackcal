# Cost optimization

28 October 2026. No new dependency, paid API, hosting service or renderer was installed for the visual refinement.

| Area | Local estimate / control |
|---|---|
| Existing Next/FastAPI/MySQL development | No new software-service charge; hardware/electricity remain real costs |
| Existing character art | Reuse current files; no regeneration fees in this pass |
| Character movement/depth | CSS + one animation frame per pointer update; no WebGL engine |
| Basic assistance/quotes | Rule-based messages and a reviewed local library; no model call required |
| Pose tracking | Future on-device MediaPipe; measure bundle/CPU/battery costs before release |
| Social media | Text/compressed images only; quotas, pagination and retention |
| Cloud hosting/storage/email | Not provisioned; cost is unknown until provider, region and volume are chosen |
| External AI | Requests × measured cost/request; enforce user quotas and a monthly budget |
| Local OCR/speech | CPU/RAM and initial model downloads; optional isolated services |

Operating-cost formula: hosting + database/storage + backups + email + bandwidth + AI usage + payment fees + moderation/support. Do not call a public production SaaS zero-cost solely because development libraries are open source. Free upstream routing can disappear or throttle; keep manual paths usable and cache only where provider terms permit.

Preserve primary data on the server, cache public/reference data with bounded expiry, serve resized images, lazy-load nonessential character UI and release camera/media streams. Prefer modular monolith deployment. Do not introduce generic video upload, live streaming, continuous location, new paid model calls or a microservice per feature in the first release.

No precise provider prices are asserted: deployment and SMTP are still deferred by the owner. Obtain current quotes after a representative pilot load is measured.
