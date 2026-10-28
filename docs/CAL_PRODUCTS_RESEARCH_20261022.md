# Cal product research and TrackCal implementation — 22 October 2026

## Two distinct products

[Cal.com's Cal.ai listing](https://cal.com/apps/cal-ai) describes an email-driven scheduling assistant: agenda questions, booking, cancellation, moving meetings and conversational follow-up from verified sender addresses. It is not a calorie tracker.

[Cal AI nutrition](https://www.calai.app/) markets photo/barcode/text food entry, macro tracking, custom recipes, fitness connections and dark mode. Its [official FAQ](https://www.calai.app/faq) discusses cloud recovery, family invites, PDF export, notifications and duplicate health-source steps. These are vendor descriptions, not TrackCal accuracy or runtime evidence.

The owner explicitly selected **nutrition SaaS with reminders and coach scheduling**, rather than a second general-purpose calendar product. TrackCal implements that scope with its own code and licensed dependencies; no proprietary mobile code, branding or private API was copied.

## REA evidence

REA launched a temporary headless Chrome profile, navigated to each supplied URL and performed a declared render wait, then captured DOM/accessibility/URL evidence. No account, purchase, email submission or private app workflow was exercised. No network bodies or headers were requested. Both temporary browsers were terminated by REA.

- Nutrition homepage evidence: `ev_a2b4d422827c3bdb8f9016d2e7f648ab32ccce31ad817f9059cbb90881a10810`; DOM SHA-256 `8f3ce5fc3a4354af78a2b70fe814be4acdfbecda8d1c5a33981fecb8edc05843`.
- Scheduling listing evidence: `ev_86407f52891f7b6ae3e9c27976b67da01bd68199f225bd0e214089d3171a93f7`; DOM SHA-256 `c26698a5793b11e2701a7807c49183bd8db529c1689f44158077b2a780fc446c`.

Evidence establishes rendered public content, not authenticated mobile behavior, depth-sensor implementation, model accuracy, health permissions or the commercial email assistant's internal architecture. See the REA skill used: `C:/Users/ragha/.agents/skills/reverse-engineer-anything/SKILL.md`.

## Other sources and customer problems

The [official iOS listing and reviews](https://apps.apple.com/us/app/cal-ai-calorie-tracker/id6480417616) corroborate lifestyle onboarding and paid scan results. Reviewers describe useful nutrition corrections and request more flexible water/workout controls. Reviews are individual reports, not independently reproduced defects or representative demand measurements. Similar-name websites such as calai.me and trackcalai.com were not treated as official product evidence.

The FAQ also highlights an import gap and notification friction. TrackCal addresses these with reviewed CSV history imports and explicit reminder control. Its health-source duplication discussion informs a future connector requirement: preserve provenance and deduplicate rather than summing every source. TrackCal does not pretend native health synchronization is a browser capability.

## Feature mapping

| Customer task | TrackCal implementation / boundary |
| --- | --- |
| Log food from photo, barcode, text or label | Existing real provider/database/OCR workflows; user review required |
| Personalize targets and recipes | Existing onboarding, recipe editor and constrained planner |
| Recover/export history | Existing account recovery adapter, explicit cloud snapshots, JSON export and printable reports; SMTP deployment still required |
| Use dark mode | Added system/light/dark control, persisted per workspace and mirrored to IndexedDB |
| Keep reminders manageable | Added create/edit/disable/remove plus .ics export; alerts are delivered by the calendar after import, not a hidden browser timer |
| Move food history between tools | Added PapaParse CSV preview, validation, exact-duplicate skipping and confirmed journal merge; documented format, not a direct MyFitnessPal integration |
| Schedule coach check-ins | Added approved-coach availability, authenticated reservations, reschedule/cancel, private agenda and calendar export; transaction locks protect slot occupancy |
| Email an autonomous scheduling assistant | Not implemented; not needed for the chosen scope. No mail inbox/provider was connected or messages sent |
| Sync Apple/Android health platforms | Candidate native integrations below; actual permissions, deduplication and physical-device testing remain |
| Shared family nutrition records | Not claimed complete; household Grocy/Mealie adapters are separate from family account-sharing permissions |
| Subscription purchases, referrals, native widgets/depth sensors | Not claimed or simulated. Initial instruction favors free features; payment processing and native capabilities require separate setup |

## Open-source integration shortlist

| Repository | License checked | Specific purpose | Status |
| --- | --- | --- | --- |
| [adamgibbons/ics](https://github.com/adamgibbons/ics) | ISC | Portable meal reminders and coach event export | Integrated, version 3.12.1 |
| [mholt/PapaParse](https://github.com/mholt/PapaParse) | MIT | Reviewed nutrition-history CSV parsing | Integrated, version 5.5.3 |
| [calcom/cal.diy](https://github.com/calcom/cal.diy) | Current root LICENSE: MIT | Optional self-hosted public booking, external calendar availability and meeting integrations | Candidate, not installed. calcom/cal.com redirects here; this does not prove the commercial Cal.ai email assistant is included |
| [kingstinct/react-native-healthkit](https://github.com/kingstinct/react-native-healthkit) | MIT | Native iOS HealthKit bridge | Candidate for mobile app; requires compatible native build and device permissions |
| [matinzd/react-native-health-connect](https://github.com/matinzd/react-native-health-connect) | MIT | Android Health Connect steps/workout bridge | Candidate for mobile app; preserve source identity and avoid double counting |
| [ntfy-sh/ntfy](https://github.com/ntfy-sh/ntfy) | Apache-2.0 / GPLv2 dual license | Optional self-hosted notifications beyond calendar export | Candidate; require private topics/authentication and explicit notification consent |

License references: [Cal.diy](https://raw.githubusercontent.com/calcom/cal.diy/main/LICENSE), [ics](https://raw.githubusercontent.com/adamgibbons/ics/master/LICENSE), [HealthKit](https://raw.githubusercontent.com/kingstinct/react-native-healthkit/master/LICENSE), [Health Connect](https://github.com/matinzd/react-native-health-connect), [ntfy terms](https://docs.ntfy.sh/terms/). Retain notices, inspect the pinned revision and recheck transitive licenses before distribution. Open-source code does not guarantee free hosting, model inference, mail delivery or third-party calendar quotas.

Previous recipe-scrapers, ingredient-parser, OR-Tools, Dexie, Grocy, Mealie, PaddleOCR, Whisper, Open Prices, wger and ZXing integrations remain documented in INTEGRATIONS_IMPLEMENTATION.md. Installing duplicate repositories is not a substitute for connecting and testing a customer workflow.

## Implementation verification and operation

Completed 22 October 2026: 135 web checks, 139 backend checks and four standalone meal-analysis checks (278 total). The web suite passed 134 checks before the final HTTP-status fix; relevant proxy/account/coach checks and the added status regression passed afterward. Production build, TypeScript and lint passed. Production npm audit reported zero advisories; previously documented development-tool and backend dependency findings remain in SECURITY_REVIEW.md.

The live loopback smoke test used three disposable accounts against the real web proxy and MySQL API. Two simultaneous reservations produced exactly one 201 and one 409; rescheduling, cancellation and slot release passed. All disposable accounts were deactivated. Backend tests cover authorization, account isolation, date validation and host-account closure releasing appointments. No real user was granted coach permissions. Browser review verified the routine page and dark appearance, then restored the original System preference. Screenshots: routine-verification.png and routine-dark-verification.png.

Open `/routine` for reminders, appointments and CSV import. Existing installations must apply backend/migrations/20261022_coaching.sql (or the explicit schema bootstrap on a fresh database) and restart the API. A real coach must have an active, verified, operator-approved professional/admin account before publishing slots. Members need verified accounts to book. Appointment access exposes only the necessary display name and time, not food journals.

Calendar exports are snapshots: import into a calendar for alerts and review imported events separately after changes. No background push delivery, automatic video room, inbox assistant or email invitation is connected. CSV import requires the documented headers and an explicit preview/merge confirmation; it is not a direct MyFitnessPal connector. Native health bridges and Cal.diy/ntfy remain suggestions, not installed services.

Public deployment, domain and SMTP remain deferred by the owner. Remaining release gates, including source packaging, recovery drills, real-device testing and independent nutrition validation, remain in RELEASE_READINESS_RESULTS.md. These changes support a controlled beta and do not establish feature parity or a perfect launch rating.
