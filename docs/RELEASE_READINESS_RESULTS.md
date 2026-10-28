# Release readiness results — 22 October 2026

## Implemented and verified

128 web tests, 129 backend tests and 4 standalone nutrition-parser checks passed: **261 automated checks** across the final suite/targeted runs. The production build, TypeScript and ESLint passed. The updated backend dependency set passes `pip check`; both active production and broader optional requirements resolve in the Windows environment. Linux container resolution/runtime still require deployment-host validation.

The web's live account test passed against actual Next/FastAPI/MySQL: signup, HttpOnly/Secure cookies, session/profile, cloud save/read, logout, wrong-password rejection, login and refresh. Its synthetic account was deactivated afterward. The runtime web-to-API health proxy returned 200/ok. Guided onboarding was inspected in the production browser; its completed persistence is covered in UI tests.

New engineering coverage includes recovery token hashing, purpose/expiry/replay, password-reset and password-change session revocation, unknown-account response parity, shared durable limits, production config rejection, readiness failure behavior, Strict Mode recovery-link handling, onboarding persistence, explicit diet-tag filtering, reverse-proxy origins and preventing provider calls when the account AI quota is denied.

## What changed

- Account recovery/verification API and client screens, SMTP adapter, credential-bound sessions, verification gates and atomic production quotas.
- Guided setup, saved planning preferences, diet-aware candidates and account backup/restore support for those preferences.
- Account/device export and confirmed account deactivation with local clearing. Closure is explicitly distinguished from permanent server erasure.
- Privacy/terms notices, product-wide navigation, keyboard focus/reduced motion, PWA manifest/icons and honest scan-estimate presentation.
- Updated dependencies, sanitized provider/request logs, production startup checks, readiness/liveness and runtime-aware health forwarding.
- Non-root Docker/HTTPS/private-network configuration, additive schema release job, CI checks, backup/disposable restore scripts and operations guide.
- Security exception register, accuracy evaluation harness and customer/economics validation protocol.

## Open launch gates

| Gate | Current evidence / action |
| --- | --- |
| Public deployment and monitoring | Prepared; owner deferred destination/domain. Docker/WSL unavailable locally. Validate built images, HTTPS, persistence, alerts, load and rollback on the chosen host |
| Real email delivery | Flow tested using a captured test mailbox; SMTP provider deferred. Configure sender/authentication/DNS and verify real delivery before inviting users |
| Source packaging / CI | Parent repository records the frontend as an embedded gitlink. Properly publish/configure the submodule or package the source before remote CI; workflow currently fails clearly if source is absent |
| Remaining dependency findings | One backend NLTK advisory with documented reachability mitigations; five upstream development-tool advisories. See SECURITY_REVIEW.md. Independent review/fix required before broad release |
| Backup recovery | Scripts prepared, not executed against Docker. SQL backups exclude uploaded files; configure encrypted off-host storage and complete the restoration drill |
| Household services | Mealie still needs a supported deployment runtime; the specified household owner email must first have a TrackCal account before binding |
| Mobile/accessibility | Web screens and simulated behavior tested; actual iOS/Android hardware, screen-reader and interruption/reconnection matrix still required |
| Accuracy | Evaluation math tested with a synthetic fixture only. Need independently weighed/reviewed food data; no accuracy percentage claimed |
| Demand and retention | No beta cohort or product-market-fit evidence yet. Follow BETA_VALIDATION.md |
| Economics and commercial policy | Need measured infrastructure/provider/support costs and tested pricing/funding. Final operator identity, contact, retention/erasure policy and commercial terms remain deployment prerequisites |

The product is substantially more prepared for a controlled beta, but it is **not honestly certified 10/10 or ready for unrestricted commercial launch**. Deployment and email setup were explicitly deferred by the owner; customer and benchmark outcomes cannot be manufactured by implementation work.

## Nutrition routines follow-up — 22 October 2026

Added reminders/calendar export, approved-coach appointment management, reviewed CSV history import and workspace appearance. Verification now totals 278 automated checks (135 web, 139 backend, four standalone), with production build/lint and a live concurrent-booking smoke test passing. See CAL_PRODUCTS_RESEARCH_20261022.md for exact test sequencing, public-site evidence, repository licenses, migration and operational boundaries. Existing launch gates above still apply.

## Readiness follow-up — 26 October 2026

Latest complete verification: 153 backend tests, 140 web tests and four standalone checks (297 total). Build/TypeScript/lint passed; current production npm audit reported zero vulnerabilities. Production-origin validation, truthful plan/quota reporting, no false provider cancellation, auth request deadlines, configuration preflight and allowlisted source packaging were added. Live API and web health checks passed. REA 6.7.0 registration and browser scenarios were verified; optional engines remain separate. See READINESS_EXECUTION_20261026.md. Docker CLI is now present but the Linux engine is unavailable. Deployment, SMTP and real-world launch evidence remain open. The source archive addresses portable packaging, while remote CI still requires correcting/publishing the embedded frontend checkout.
