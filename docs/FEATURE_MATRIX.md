# TrackCal 4.0 feature matrix

28 October 2026. Implemented means code and prior/local test evidence exist, not universal device or production certification. Partially implemented includes a missing service, UX or operational dependency. No current feature is labeled broken solely because it is unconfigured.

| Feature | State | Evidence / limit |
|---|---|---|
| Signup/login/session/profile/logout | Implemented | Auth routes, account UI, automated/prior live checks |
| Verification/reset email | Partially implemented | Token flows exist; SMTP delivery deferred |
| Account export/deactivation | Implemented | Deactivation does not mean immediate erasure |
| Local journal CRUD / corrections / dates | Implemented | Existing feature and scope tests |
| Nutrition references and dashboard | Implemented | Live progress and automated tests |
| Goal calculator / measurements | Partially implemented | Existing calculator; optional-private-measurement redesign still needed |
| AI photo/text estimates | Implemented | Provider-dependent, reviewable; accuracy benchmark missing |
| Barcode camera/photo/manual lookup | Implemented | Preview repair, local photo path, lifecycle tests; physical coverage incomplete |
| USDA / OFF search | Implemented | Network-dependent; missing nutrients remain explicit |
| Recipe extraction / ingredient parsing | Implemented | Reviewed recipes, source guards and tests |
| Budget/nutrition-constrained meal solver | Implemented | Feasibility checked; requires valid recipe inputs |
| Pantry / shopping / public prices | Implemented | Optional sources vary in coverage |
| OCR / speech | Partially implemented | Adapters and prior live evidence; workers/device prerequisites |
| Water / weight / activity records | Implemented | Manual records, not sensor verification |
| Exercise discovery | Implemented | Catalog adapter and manual workout records |
| MediaPipe pose / rep tracking | Missing | No shipped exercise-camera flow |
| Meal trends / CSV / printable reports | Implemented | Based on records available in workspace |
| Backup / restore / revisions | Implemented | Explicit snapshots, not automatic full sync |
| Complete cold-start offline app | Partially implemented | Recovery and local journal paths, no full native guarantee |
| Calendar reminders / export | Partially implemented | Local/ICS paths; closed-browser delivery not established |
| Coach booking / reschedule / cancel | Implemented | Owner/role/concurrency checks; real coach approval/setup still required |
| Trainer multi-client dashboard | Missing | Scheduling is not multi-client program management |
| XP / levels / badges / task streaks | Implemented | Server ledger, level unlocks and quest tests |
| Six companions / daily plan / check-ins | Implemented | Rule-based, existing raster assets; no paid AI required |
| Shared persistent floating assistant | Partially implemented | Existing floating dock is Play-specific |
| Independent daily quote library | Missing | Companion messages are not a complete quote module |
| Pantry Puzzle / Garden Dash | Missing | Displayed as planned |
| Food corrections/community submissions | Partially implemented | Backend submission/mine routes, no full moderation workflow |
| Social text/image feed / follows | Missing | Submission schema is not a social network |
| Groups / community moderation | Missing | No shipped groups/roles/reporting UI |
| Verified events / location / QR check-in | Missing | Calendar events do not verify attendance |
| Verified fitness challenges | Missing | Learning quests are not verified workout challenges |
| Organizer dashboard | Missing | No event-management product |
| Consumer/business paid plans | Partially implemented | Status/catalog scaffolding; payment and entitlements disconnected |
| Support workflow | Partially implemented | Ticket API; staffing/moderation SLA unverified |
| Public production operations | Partially implemented | Compose/config/preflight exist; domain/SMTP/recovery evidence deferred |

Resolved historical defect: camera preview previously reported ready without usable frames. Stream ownership/playback recovery was implemented and observed at 1280×720 in the prior camera follow-up. Any new failure should be reproduced before labeling the current feature broken.

## Phase 1 gamification integration — 28 October 2026

| Addition | State | Boundary |
|---|---|---|
| Central configurable reward engine | Implemented | Server rules, daily/global caps, unique source IDs; legacy ledger reused |
| Workout participation reviews | Implemented | Private explicit self-report; no physical completion verification |
| Persistent achievement engine | Implemented | First activity/workout, consistency and planned-rest awareness |
| Flexible engagement streak/rest/protection | Implemented | User-local dates; no XP for rest; strict task streak retained separately |
| Shared persistent floating companion | Implemented | Root-mounted on authenticated application routes; server customization, SVG cosmetics and CSS motion |
| Skill/community/event/challenge/recovery rewards | Disabled contracts | No fake producers or verified badges; future modules remain missing |

The earlier Play-only floating-assistant row describes the pre-integration audit and is superseded by this section. Rules, architecture, correction/retention policy and limitations are in GAMIFICATION_RULES.md and GAMIFICATION_ARCHITECTURE.md.

## Phase 2 personalization — 28 October 2026

| Addition | State | Boundary |
|---|---|---|
| Signed-in eight-step onboarding/save-resume | Implemented | Validated account draft; no offline unsaved-keystroke persistence |
| Measurement history/conversion/BMI arithmetic | Implemented | Optional/private; no BMI classification or body-based XP/intensity |
| Weekly personal activity plans and editing | Implemented | Curated application-reviewed templates; self-reported completion |
| Meal preferences/allergy-aware ideas | Implemented | No cross-contact certification or invented nutrient/price totals |
| Personalized in-app reminders | Implemented | Visible-app polling; no closed-browser push guarantee |
| Basic planner/fitness/nutrition lessons | Implemented | Server-scored and first-time rewards; not a full skills curriculum |
| Onboarding/plan badges and planned recovery XP | Implemented | Existing reward engine; daily/global and lifetime duplicate controls |
| Community/event interest categories | Disabled suggestions | No operational social/event module or verified badge |
| Language preference | Partially implemented | Stored preference; interface is currently English |

Phase 2 evidence and limitations: PHASE_TEST_REPORT.md, PHASE_2_IMPLEMENTATION.md and LIMITATIONS_REGISTER.md. Earlier audit rows are historical and are superseded only for the implemented scope above.

## Phase 3 nutrition and sessions — 28 October 2026

| Feature | State | Boundary |
|---|---|---|
| Cloud nutrition dashboard/diary CRUD | Implemented | Existing canonical meal tables; clearly separate from device-only journal |
| Regional aliases/search/category/paging | Implemented | Prefix/aliases and bounded substring fallback; missing composition remains unknown |
| Owned food favorites/reusable meals/recent history | Implemented | Existing saved_meals reused; legacy unsupported snapshots require review |
| Scanner local preview/manual confirmation/correction | Implemented | Explicitly manual, not invented AI recognition; optional existing inference needs consent |
| Stored image deletion API | Implemented | Owner/path guard; metadata/provider retention remains a separate policy issue |
| Exercise library/details/favorites/saved workouts | Implemented | Application-reviewed conservative catalog; no clinical verification or unlicensed media |
| Detailed persistent workout sessions/sets/history | Implemented | Private self-report, revisions, local drafts and server completion guards |
| Plan-linked sessions/calendar/milestones | Implemented | Actual records; shared reward source and daily caps prevent double awards |
| Larger text/character movement/micro-interactions | Implemented | Motion/celebrations optional; no heavy 3D renderer |

Final evidence: PHASE_TEST_REPORT.md, phase3-browser-evidence.json and phase3-performance.json. Physical/clinical/large-scale claims and future pose/social/event modules remain outside this phase.


## Phase 4 additions — 28 October 2026

| Feature | Implementation | Verification boundary |
|---|---|---|
| Private camera workouts | Explicit camera, device/facing choice, overlay/feedback toggles, pause/resume/reset/rest/end/review | Chromium synthetic media journey; physical devices NOT VERIFIED |
| Local pose estimation | Pinned/self-hosted MediaPipe Lite CPU/WASM in classic worker, lazy loading and bounded sampling | Real model blank/static-person inference, 33 landmarks; not a measured rep-accuracy result |
| Rep estimates | Separate squat, floor push-up and single-arm curl analyzers, stable hysteresis states, confidence/visibility rejection | Deterministic fixtures and synthetic browser input; no perfect/form/medical-safety claim |
| Confirmed workout history | Existing owned sessions API/JSON, estimated vs corrected vs manual labels, revision/UUID retries | Real API/MySQL browser persistence, failure retry and owner tests |
| Personal-plan integration | Explicit eligible camera substitution and matching today activity, same transaction/source ID | Backend integration verifies completion and no second plan reward; camera is not automatically prescribed |
| Camera participation achievements | First Camera Workout, Movement Explorer, Tracking Milestone via central audits | Server tests + actual browser unlock; no count/appearance/confidence rewards |
| Camera companion | Same character in reserved space, contextual guidance, optional existing celebration/preferences | Portal-aware desktop/mobile/tablet geometry and reduced-motion checks |
| Privacy lifecycle | No video recording/upload/audio request; tracks/worker released on stop/pause/end/hide/navigation/error | Unit + synthetic browser checks; real OS/browser permission matrix NOT VERIFIED |

These rows supersede earlier “camera pose tracking not implemented” descriptions only within this scope. Existing social/community/verified-skill/clinical or production operational placeholders remain unimplemented.
