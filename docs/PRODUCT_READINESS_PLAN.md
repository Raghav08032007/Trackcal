# TrackCal product readiness plan — 22 October 2026

The objective is a reliable, supportable nutrition product with evidence for launch. A perfect score is not a release criterion. Passing tests is not proof of nutrition accuracy, customer demand or production availability.

## Delivery sequence

1. Account trust: single-use email verification and password recovery; session revocation after password change; durable abuse controls; account export/deletion controls.
2. First-use experience: guided onboarding, explicit goals/preferences, consistent navigation, accessible states and reduced motion.
3. Production foundation: reproducible containers, database bootstrap/migrations, readiness/liveness, structured sanitized logs, HTTPS deployment configuration, backup/restore procedure and CI.
4. Reliability: account isolation, token expiry/replay, concurrent quotas, provider failures, offline queues and recovery tests. No unbounded or silently invented inference.
5. Product trust: uncertainty/portion review, source attribution, published privacy/data controls, nutritional validation protocol and customer-visible service limitations.
6. Launch evidence: representative device tests, deployment smoke/load tests, recovery drill, reviewed operating costs, beta interviews and measured activation/retention.

## Launch gates

| Dimension | Required evidence |
| --- | --- |
| Functionality | Core account → log → review → persist → backup → restore journeys pass |
| Usability | Target users complete onboarding and first log without assistance; keyboard and mobile checks |
| Accuracy | Reviewed benchmark with weighed portions, error distribution and correction rates; no unsupported accuracy claim |
| Security/privacy | Recovery replay and ownership tests, revocation, durable limits, secret handling, restore/deletion controls; independent review before broad launch |
| Operations | Public HTTPS deployment, healthy monitoring, tested backup restoration, alert recipient, controlled migrations and rollback |
| Mobile | Actual iOS/Android camera, microphone, permission denial, offline startup and reconnection checks |
| Differentiation | Target users prefer pantry/budget workflow to their current alternative; document reasons |
| Customer validation | A defined beta cohort, activation/retention measured with informed consent; interviews recorded without sensitive nutrition data |
| Sustainability | Actual hosting/model/support cost per active user and a tested pricing or funding hypothesis |

Deployment destination/domain and email-provider configuration are external inputs. Household account binding still requires the supplied owner to register. OS/runtime installation requiring a reboot, real device access, external credentials, and user research are not silently marked complete.

## Execution record

Implementation and verification results are appended as work is completed. Earlier baseline: 120 web checks, 119 backend checks and 4 standalone parser checks; local media/public API tests. See FEATURE_TEST_REPORT.md and UNFINISHED_TASKS_STATUS.md for boundaries.

### Implemented in this pass

- Single-use recovery/verification API and UI, credential-bound session revocation, production verification gates and shared request quotas.
- Guided setup with persisted targets, budget, currency and dietary preferences; restricted diets require explicit reviewed recipe tags. Preferences are included in account workspace backups.
- Account/device export, explicit confirmed account deactivation and local clearing, privacy/terms notices, mobile-accessible product links and reduced-motion/focus improvements.
- Installable web manifest/icons and offline guest journal. Removed the uncalibrated confidence percentage from scan presentation; estimates explicitly require review.
- Reproducible non-root deployment files, HTTPS proxy, private database/API networking, additive release schema job, readiness/liveness, sanitized structured request logs and operations/backup/restore guidance.
- CI workflow with a frontend source-packaging guard; updated security-sensitive dependencies and recorded remaining upstream advisories.
- Accuracy evaluation harness and beta validation protocol. No benchmark values, customer outcomes or operating costs were invented.

### Final gates, intentionally not marked complete

The owner deferred deployment and email-provider setup to the final stage. Configure those on the chosen host, validate containers/SMTP/HTTPS, execute the disposable restore and controlled load tests, resolve the frontend gitlink, review the outstanding dependency exceptions, perform physical device/accessibility testing and run the customer/accuracy/economics studies. See SECURITY_REVIEW.md, BETA_VALIDATION.md and infrastructure/OPERATIONS.md. A public release is not yet certified.
