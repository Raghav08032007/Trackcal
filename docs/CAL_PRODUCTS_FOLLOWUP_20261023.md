# Product comparison follow-up — 23 October 2026

Scope remains the owner's chosen nutrition SaaS with meal reminders and coach scheduling. The detailed comparison and repository shortlist are in CAL_PRODUCTS_RESEARCH_20261022.md. This follow-up extends that work rather than claiming all commercial features have been cloned.

## Refreshed public evidence

Revisited https://www.calai.app/, https://www.calai.app/faq, https://cal.com/apps/cal-ai and the official iOS listing https://apps.apple.com/us/app/cal-ai-calorie-tracker/id6480417616. The nutrition site describes photo/barcode/text entry, macros, recipes and fitness connections. The scheduling listing describes a verified-sender email assistant with agenda, booking, cancellation and rescheduling. The FAQ documents an import gap; app-store reviewers request flexible water/workout controls. These are vendor descriptions and individual reviews, not independently validated accuracy or representative customer research.

REA captured the rendered public nutrition homepage and scheduling listing in temporary headless browser processes, with URL/DOM capture and no selected network events, bodies or headers. Both processes were terminated by REA. Nutrition evidence: ev_a36f98359791acbff0a8bb14d07c6c9865dfa0f845fb63e8079aeb39a9b6c702. Scheduling evidence: ev_6d2eee9a5b76ab0efce8febd043bd19bcf1815059eb3c4da2bd3ce1210db67c5. Machine-readable bounded metadata is in research/rea-public-sites-20261023.json. No authenticated competitor workflows were exercised.

## Additional implementation

Added a local CSV export to `/routine`, completing the reviewed CSV import/export workflow using the existing MIT-licensed PapaParse dependency (https://github.com/mholt/PapaParse). Customers choose an inclusive date range; export includes only that workspace's meals. Quoted names and numeric nutrition values are preserved; older English 12-hour times are normalized to 24-hour times. Import duplicate detection now recognizes equivalent 12/24-hour clock strings. Unsupported time formats require review rather than inventing a time.

Exports obey the existing 5,000-row/2 MB import contract. Invalid records stop the export; no meals are silently discarded by the new exporter. Formula-like names receive a protective apostrophe for spreadsheet use; that apostrophe remains if reimported. CSV is a meal interchange format, not a replacement for the full account JSON backup. No food data is sent to another service.

## Verification

- Full web suite: 138 checks passed across 23 files. After the final duplicate-time normalization change, all eight relevant history/routine checks passed again.
- Lint passed. Production TypeScript/build passed with `npm run build -- --webpack`.
- Default Turbopack build first failed on restricted Google-font fetches, then on CSS-worker startup. The supported webpack build completed successfully; no permanent build-script change was made.
- Browser review confirmed the new date controls and the explicit empty-range message. Screenshot: history-export-verification.png. The successful download path and unchanged stored meals were verified in the component test using disposable synthetic data.
- Backend was unchanged this pass; its 139 passing checks and the live reservation-race result are prior-run evidence, not a new backend run today.

## Repository priorities and remaining work

The shortlist remains: ics for calendars (integrated), PapaParse for data portability (integrated), Cal.diy for optional external-calendar booking, react-native-healthkit and react-native-health-connect for native mobile permissions/sync, and ntfy for optional private notifications. The latter four are candidates, not installed or connected features. Licenses and integration boundaries are documented in the prior report; recheck pinned revisions before adopting them.

Deployment, domain and SMTP remain deferred by the owner. Real coach onboarding, household-owner binding, native health sync, external calendar sync, push delivery, recovery drills, source packaging and physical-device tests remain release work. Existing security findings and validation gates in RELEASE_READINESS_RESULTS.md and SECURITY_REVIEW.md still apply. No 10/10 rating or unrestricted launch certification is claimed.
