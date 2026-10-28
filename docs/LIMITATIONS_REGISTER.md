# Cross-phase limitations register

Updated: 28 October 2026. This is the central backlog for limitations recorded during every TrackCal phase. The user requested that these be retained and reviewed for rectification after all phases are complete. Recording a limitation does not authorize starting another phase or implementing its fix.

## Tracking policy

- Append discoveries at each phase handoff; link the phase report and keep stable IDs. Do not erase unresolved items when a phase passes its local acceptance tests.
- Distinguish an implementation gap, an evidence gap, an external prerequisite and an intentional product boundary. A missing future module is not a failed existing feature.
- Current completion evidence: Phase 0 audit/visual work and Phase 1 gamification are complete within their documented scopes. Phase 2 implementation and local acceptance are complete, with final verification recorded in PHASE_TEST_REPORT.md; Phase 3 nutrition/session implementation is delivered with its final local evidence in PHASE_TEST_REPORT.md; Phase 4 camera tracking is implemented with automated/static-inference evidence and physical-device/accuracy acceptance NOT VERIFIED; Phases 5–6 remain unstarted. Earlier planning entries are retained with their original IDs.
- Planned timing: one consolidated rectification pass after the remaining phases. Items marked **Launch gate** must still be resolved or explicitly scoped out before public paid launch. Intentional boundaries should remain honestly disclosed rather than be “fixed” through unsupported claims.
- Close an item only with a dated implementation/evaluation reference and passing acceptance evidence. Preserve the original entry and record the resolution in the closure log.
- No credentials, tokens, customer measurements, private media or household identities belong in this register.

## Phase 0 / cross-product audit

| ID | Limitation / current boundary | Kind | Rectification acceptance | Gate | Source |
|---|---|---|---|---|---|
| P0-01 | Nutrition estimates lack a representative weighed-portion accuracy benchmark | Evidence gap | Evaluate a consented/reviewed dataset; report error distributions and correction rates | Launch gate for accuracy claims | PRODUCT_READINESS_PLAN.md |
| P0-02 | Barcode preview repair and synthetic decoding do not establish detection on every real product/device/lighting condition | Evidence gap | Separate detection from catalog coverage in a measured physical-device matrix | Launch gate for supported-device claims | BARCODE_RELIABILITY_20261027.md |
| P0-03 | Food catalogs and price APIs have network, regional, missing-nutrient, currency/unit and freshness limits | Product boundary | Keep unknowns explicit, retain provenance and verify failure/fallback behavior for supported markets | Review before launch | FEATURE_MATRIX.md; INTEGRATIONS_IMPLEMENTATION.md |
| P0-04 | Independent keyboard/screen-reader and physical iOS/Android accessibility/device coverage remains incomplete | Evidence gap | Record representative users/devices, permissions, interruption and assistive-technology journeys | Launch gate | PRODUCT_READINESS_PLAN.md |
| P0-05 | Separate Expo/mobile material is not a certified production mobile app | Scope/evidence gap | Verify native/emulator release journeys if a mobile release is included | Mobile release gate | CURRENT_STATE.md |
| P0-06 | Optional/private measurement and goal-calculator redesign remains partial | Implementation gap | Verify optional inputs, privacy and clear reference-only presentation | Review before launch | FEATURE_MATRIX.md |
| P0-07 | Character depth is raster art + CSS, not an articulated real-time 3D model; encouragement is scripted | Intentional boundary | Preserve existing art and performance; evaluate any richer animation separately without medical claims | Disclosure | FLOATING_COMPANION_SPEC.md |

## Phase 1 — gamification

| ID | Limitation / current boundary | Kind | Rectification acceptance | Gate | Source |
|---|---|---|---|---|---|
| P1-01 | Workout reviews validate a private self-report, not physical exercise completion | Intentional boundary | Keep labels honest; add a separately verified producer only if a later module supports it | Disclosure | GAMIFICATION_ARCHITECTURE.md |
| P1-02 | Feasible-plan rewards represent planning, not adherence; rest badges represent awareness, not treatment | Intentional boundary | Retain participation wording and no health-outcome claims | Disclosure | GAMIFICATION_RULES.md |
| P1-03 | Basic Phase 2 fitness education and self-reported planned recovery are connected; full skill/community/event/challenge verification and associated future badges remain disabled | Deferred modules | Build and verify the real producer, ownership, evidence and retries before enabling each contract | Feature enablement gate | GAMIFICATION_ARCHITECTURE.md |
| P1-04 | Summaries read per-user reward history and compute streaks in memory; multi-year/high-volume scale is unbenchmarked | Scaling gap | Load-test realistic history; add compatible aggregation/pagination if needed | Production capacity gate | GAMIFICATION_ARCHITECTURE.md |
| P1-05 | Dashboard, Play and root companion make separate initial summary requests | Optimization gap | Share an account-bound cache with invalidation, logout/switch isolation and retry tests | Rectification backlog | FLOATING_COMPANION_SPEC.md |
| P1-06 | Calm motion is device/account-scoped; other companion settings persist server-side | Product boundary | Decide whether cross-device motion sync is needed; preserve reduced-motion override | Rectification backlog | FLOATING_COMPANION_SPEC.md |
| P1-07 | No voice/LLM companion, arbitrary dragging, physics or articulated skeleton | Intentional scope | Validate demand/cost/accessibility before optional expansion; keyboard dock controls stay available | Optional | FLOATING_COMPANION_SPEC.md |
| P1-08 | Participation XP/history is retained when a local activity is corrected/deleted; deactivation is not immediate erasure | Retention policy gap | Review retention/correction/erasure semantics and verify account export and deletion behavior | Launch privacy gate | GAMIFICATION_ARCHITECTURE.md |
| P1-09 | Protection toggles recompute streak history; formula changes can change displayed levels; rest/protected days extend calendar streaks | Product boundary | Confirm wording and configuration migration policy; retain earned XP and unlocks | Product review | GAMIFICATION_RULES.md |
| P1-10 | Migration row-count check assumes a quiet release window; it is not a backup/content checksum | Operational limitation | Backup/restore and controlled migration/rollback drill on target deployment | Launch gate | GAMIFICATION_ARCHITECTURE.md |
| P1-11 | Achievement celebration cooldown lasts while the root companion is mounted | Product boundary | Assess reload/reconnect frequency and persist deduplication if notifications become noisy | Rectification backlog | FLOATING_COMPANION_SPEC.md |
| P1-12 | Operational rules may disable XP; current streak/achievement participation metrics derive from positive rewarded ledger entries | Product boundary | Decide whether zero-XP validated engagement should qualify, migrate without duplicating old activities, and test caps/history | Product review | GAMIFICATION_RULES.md; backend/services/gamification.py |

## Phase 2–3 delivery / Phases 4–5 planning constraints

Phase 2 personalization and Phase 3 nutrition/sessions are implemented; the limitations below distinguish their boundaries from unstarted Phases 4–5. Add actual discoveries and final reports at each handoff; do not close an item from planned code alone.

| ID | Area / current limitation | Kind | Rectification acceptance | Gate | Source |
|---|---|---|---|---|---|
| P2-01 | Phase 2 in-app scheduling and local/ICS reminders do not establish closed-browser push delivery or background scheduling guarantees | Evidence/platform gap | Verify quiet hours, delivery, permission denial and documented supported-platform limits | Reminder claim gate | FEATURE_MATRIX.md |
| P2-02 | Independent quote library, customizable quests and weekly reflection from the earlier roadmap are outside the implemented Phase 2 personalization brief | Deferred module | Verify actual routes, persistence and accessible empty/failure states | Feature enablement gate | PHASED_IMPLEMENTATION.md |
| P2-03 | Cloud backup is explicit snapshots, not continuous multi-device sync; conflicts need user review | Intentional boundary | Verify reconnect/conflict recovery and choose any later sync model explicitly | Disclosure | CURRENT_STATE.md |
| P2-04 | Guest offline journal works; authenticated cold-start offline and closed-browser background backup are not guaranteed | Platform/scope gap | Real offline/reconnect device checks; keep private account responses out of public caches | Offline claim gate | UNFINISHED_TASKS_STATUS.md |
| P3-01 | Pose estimation, rep tracking and full exercise-camera workflows are missing | Deferred module | Opt-in on-device flow, confidence limits, alternatives and real-device tests | Feature enablement gate | FEATURE_MATRIX.md |
| P3-02 | OCR/Whisper depend on workers/models; English OCR and test audio do not certify languages or real capture broadly | External/evidence gap | Pin runtime/model setup; test expected language/device matrix and worker failures | Supported-media gate | INTEGRATIONS_IMPLEMENTATION.md |
| P3-03 | Pose/rep estimates must not imply form diagnosis, clinical advice or verified exercise by themselves | Intentional boundary | Explicit uncertainty, privacy/consent and accessible manual alternatives | Claim gate | ARCHITECTURE_REVIEW.md |
| P4-01 | Food submissions are not a moderated social feed; posts/follows/groups/blocks/reports and moderation are missing | Deferred module | Ownership/visibility/moderation/abuse/retention tests and staffed workflows | Public sharing gate | FEATURE_MATRIX.md |
| P5-01 | Organizer, verified attendance, QR/location and fitness-challenge workflows are missing | Deferred module | Expiring/replay-resistant evidence, role checks, consent and non-GPS alternatives | Verification gate | PHASED_IMPLEMENTATION.md |
| P5-02 | Existing learning quests and calendar bookings do not establish verified challenge completion or event attendance | Intentional boundary | Keep verification badges disabled until evidence-backed producers pass tests | Badge enablement gate | GAMIFICATION_ARCHITECTURE.md |

## Additional Phase 2 limitations recorded at handoff

| ID | Limitation / boundary | Kind | Rectification acceptance | Gate | Source |
|---|---|---|---|---|---|
| P2-05 | Language preference is saved; interface and educational content remain English | Implementation scope | Prioritize translations, localize validation/education, test layouts and accessibility in supported languages | Localization claim gate | ONBOARDING_FLOW.md |
| P2-06 | Planned workout/recovery completion is a self-report; no sensor, professional or event verification | Intentional boundary | Preserve participation labels; introduce separately tested verified producers only when supported | Disclosure | PERSONALIZATION_ENGINE.md |
| P2-07 | Templates have an application safety review, not independent clinical certification; free-text professional restrictions cannot be interpreted medically | Safety/evidence boundary | Retain fail-closed exercise/meal review states; obtain qualified review for expanded clinical or population-specific offerings | Claim gate | PERSONALIZATION_ENGINE.md |
| P2-08 | Small curated meal/activity catalogs; unknown allergies suppress suggestions; no cross-contact certification or inferred nutrient/price totals | Catalog/trust boundary | Expand reviewed catalog and regional/allergen coverage with provenance and validation; keep unknowns explicit | Offering claim gate | PERSONALIZATION_ENGINE.md |
| P2-09 | Saved onboarding steps resume in MySQL; unsaved keystrokes are memory-only and cloud saves need connectivity | Offline limitation | Decide on an account-isolated encrypted/local draft model; test conflicts and shared-device clearing before promising offline resume | Rectification backlog | ONBOARDING_FLOW.md |
| P2-10 | Plans cover remaining days of the local week; manual rescheduling extends only 28 days; generation uses conservative fixed duration caps | Product boundary | Validate longer schedules and richer progression against comfort/professional guidance, never XP/body measurements | Product review | PERSONALIZATION_ENGINE.md |
| P2-11 | State shows up to 200 recent measurements and 50 feedback rows; polling/history scans and request duplication lack production-scale benchmarks | Scale/UX limitation | Add safe pagination/caching/aggregation with owner isolation and representative load tests; preserve complete exports | Production capacity gate | WELLNESS_CALCULATIONS.md; PHASE_2_IMPLEMENTATION.md |
| P2-12 | Personalization timezone is editable, while reward timezone remains fixed; age/measurements are self-reported and no pediatric BMI interpretation is provided | Intentional boundary | Keep both clocks and age safeguards explicit; validate clinical interpretation separately before adding it | Disclosure/claim gate | WELLNESS_CALCULATIONS.md; PERSONALIZATION_ENGINE.md |
| P2-13 | Bounded real-browser harness uses an existing local Playwright/Chrome runtime and a disposable credential file; portable CI browser setup is not provisioned | Test infrastructure gap | Configure browser runtime and isolated synthetic test credentials in CI, then repeat the bounded scenario | CI browser evidence gate | frontend/web/tests/e2e-phase2.mjs |

## Additional Phase 3 limitations recorded at handoff

| ID | Limitation / boundary | Kind | Rectification acceptance | Gate | Source |
|---|---|---|---|---|---|
| P3-04 | New cloud diary/session records are explicit account features; legacy device journals/workouts are preserved separately without silent import or continuous merge | Product/data boundary | Design opt-in owner-bound migration/sync, ID reconciliation and conflict recovery before promising one merged history | Product review | NUTRITION_ARCHITECTURE.md; WORKOUT_TRACKING.md |
| P3-05 | Local photo confirmation is manual; existing AI remains optional and uncalibrated; hidden ingredients, allergens and exact portions cannot be inferred reliably | Accuracy/trust boundary | Retain honest labels and review; evaluate a representative recognition dataset before stronger claims | Recognition claim gate | FOOD_SCANNER_SPEC.md |
| P3-06 | Curated exercise catalog is small/application-reviewed, with no licensed demonstration media or multi-skill verification curriculum | Content/evidence gap | Qualified content review, licensed media, broader accessibility/equipment coverage and actual skill verification | Expanded exercise claim gate | WORKOUT_TRACKING.md |
| P3-07 | Timings were measured on a 31-food local test catalog; substring fallback and large offsets need large-catalog/load evaluation | Scale evidence gap | Benchmark representative catalog/users; consider full-text/cursor search and query plans without losing regional aliases | Production capacity gate | phase3-performance.json |
| P3-08 | Favorites/saved-meal/recent previews are bounded; unsupported legacy saved snapshots require review rather than automatic nutrient conversion | Scale/compatibility boundary | Add paginated collections and explicit legacy snapshot review/conversion with provenance tests | Rectification backlog | NUTRITION_ARCHITECTURE.md |
| P3-09 | Local photo deletion removes the browser reference; backend deletion removes a checked owned file, while scan metadata and external-provider retention follow separate policies | Privacy/retention boundary | Review retention/erasure UX and provider terms; do not promise provider-side erasure from local deletion | Privacy release gate | FOOD_SCANNER_SPEC.md |
| P3-10 | Workout completion/duration/sets are self-reported; no pose, sensor, calorie-burn or clinical verification is shipped | Intentional boundary | Keep participation labels and caps; add independently tested verification only in an approved future module | Disclosure | WORKOUT_TRACKING.md |
| P3-11 | Local session drafts protect failed saves but authenticated cold-start offline, multi-device live sync and stale-revision merging are not guaranteed | Offline/sync limitation | Owner-isolated recovery tests, explicit conflict merge and broader storage/device validation | Offline claim gate | WORKOUT_TRACKING.md |
| P3-12 | Incomplete linked sessions depend on their plan still being active/current; archived plans require review or ending the session rather than bypassing eligibility | Product boundary | Design explicit unlink/reschedule recovery with immutable completion/reward identity tests | Rectification backlog | WORKOUT_TRACKING.md |
| P3-13 | Character motion is CSS over the existing art, not articulated skeletal 3D; corner dock may overlap noninteractive content at some scroll positions | Interaction boundary | Retain motion/visibility/dock controls; extend safe-area and physical-keyboard-device checks before universal coverage claims | UX review | FLOATING_COMPANION_SPEC.md |
| P3-14 | Desktop/mobile/tablet checks use Chromium and emulated viewport/motion settings; real camera/device, audible screen-reader and broader-browser coverage remain unverified | Evidence gap | Complete the supported physical device/browser/assistive-technology matrix | Supported-platform gate | PHASE_TEST_REPORT.md |
| P3-15 | Dedicated test schema/ports and existing local Playwright runtime require environment setup for portable CI; setup does not receive or store administrator passwords | Test infrastructure boundary | Provision isolated CI database/browser runtime and run repeatable synthetic-only E2E with cleanup | CI browser evidence gate | PHASE_3_IMPLEMENTATION.md |

## Phase 6 / final release and external prerequisites

| ID | Limitation / deferred decision | Kind | Rectification acceptance | Gate | Source |
|---|---|---|---|---|---|
| P6-01 | Public host/domain/HTTPS deployment deferred by owner | External prerequisite | Choose destination/domain and verify real HTTPS, proxy behavior and smoke tests | Launch gate | PRODUCT_READINESS_PLAN.md |
| P6-02 | SMTP provider/delivery deferred; token tests do not prove real verification/reset email arrival | External prerequisite | Configure secret server-side credentials; test delivery, expiry, replay and abuse | Launch gate | PRODUCT_READINESS_PLAN.md |
| P6-03 | Docker/Compose target runtime, controlled load, monitoring/alerts, incident response, rollback and restoration drills are unverified | Operational/evidence gap | Execute and record on target host, with alert owner and recovery objectives | Launch gate | SECURITY_REVIEW.md; infrastructure/OPERATIONS.md |
| P6-04 | Checkout/payment webhooks, entitlements, refunds/cancellation and reconciliation are not end-to-end active | Implementation gap | Test-mode full lifecycle with signed/idempotent webhooks before live charging | Paid launch gate | FEATURE_MATRIX.md |
| P6-05 | Multi-client trainer programs and real coach approval/operations are incomplete beyond booking features | Implementation/operations gap | Role/consent/client isolation and real operational workflow evidence | Coaching offering gate | FEATURE_MATRIX.md |
| P6-06 | Grocy private access awaits confirmed existing household owner binding; Mealie service is not deployed in recorded evidence | External prerequisite | Recheck account/service state, bind only authorized owner, verify private reads and startup | Household feature gate | UNFINISHED_TASKS_STATUS.md |
| P6-07 | Embedded frontend checkout/gitlink requires review before relying on remote packaging/CI | Release gap | Reproducible clean checkout, complete source package and CI pass | Launch gate | SECURITY_REVIEW.md |
| P6-08 | Dependency exceptions recorded in the 22 October security audit require re-evaluation; those are historical audit results | Security evidence gap | Fresh app/container/OS scans; patch/replace or document independent risk acceptance | Launch gate | SECURITY_REVIEW.md |
| P6-09 | Independent security review, provider terms/data processing, retention/erasure, backup encryption and secret rotation need final review | Security/privacy gap | Review actual deployment and prove controls with dated evidence | Launch gate | SECURITY_REVIEW.md |
| P6-10 | Pilot activation/retention, customer preference, accuracy outcomes and actual unit economics are not established | Market/evidence gap | Consenting cohort, measured results and costs; validate pricing hypothesis | Commercial readiness gate | BETA_VALIDATION.md; PRODUCT_READINESS_PLAN.md |
| P6-11 | Support ticket APIs do not establish staffed response/moderation SLAs | Operational gap | Assign operators, escalation procedures and measurable response commitments | Offering/SLA gate | FEATURE_MATRIX.md |

## Phase 4 camera tracking — delivered boundaries

The earlier P4-01 social-feed entry is retained as a historical planning constraint; camera tracking is the explicitly approved Phase 4 scope in this handoff.

| ID | Limitation / current boundary | Kind | Rectification acceptance | Gate | Source |
|---|---|---|---|---|---|
| P4-02 | Physical iOS/Android/desktop camera permissions, front/rear switching, interruption and all browser-engine support are NOT VERIFIED | Device evidence gap | Dated actual-device permission, lifecycle, switching and save matrix; name only tested combinations as supported | Camera release gate | CAMERA_PRIVACY.md; PHASE_TEST_REPORT.md |
| P4-03 | Rep thresholds are provisional 2D heuristics; no representative human-motion accuracy benchmark | Accuracy evidence gap | Consented expert-labeled held-out set across exercises, variations, lighting, clothing, body/mobility differences; report false/missed counts and corrections | Accuracy claim gate | REP_COUNTING_ENGINE.md |
| P4-04 | Static-image model timings and emulated layouts do not establish physical-mobile battery, heat, memory or sustained responsiveness | Performance evidence gap | Real low/mid/high device sessions; latency, dropped frames, memory/battery/thermal limits and graceful fallback | Supported-device release gate | POSE_ESTIMATION_ARCHITECTURE.md |
| P4-05 | Familiar side-on squat, floor push-up and one-arm curl only; partial/occluded/crowd/view movement may reject or miscount | Intentional scope | Keep limitations and manual correction/fallback visible; validate any added variation separately | Disclosure | REP_COUNTING_ENGINE.md |
| P4-06 | Camera confidence describes landmark visibility, not medical safety, form quality or verified skill | Intentional boundary | No diagnostic/competitive confidence claims; any specific form cue needs reliable measurements and qualified review | Disclosure / future review | CAMERA_PRIVACY.md |
| P4-07 | Camera metadata is client-reported; server validation/caps cannot prove physical exercise | Trust boundary | Keep participation badges noncompetitive/nonclinical; evaluate attestation only if a separately approved product needs it | Disclosure | GAMIFICATION_RULES.md |
| P4-08 | Active unsummarized camera counts are page-memory only; review summaries persist locally, confirmed snapshots follow existing account retention/soft-delete rules | Retention / recovery boundary | Clear UX; test interruption/restoration and deployed erasure policies; never silently retain video/landmarks | Review before launch | CAMERA_PRIVACY.md |
| P4-09 | Self-hosted model/WASM preparation needs build-time network or preprovisioned verified assets; first load has memory/download cost | Deployment prerequisite | Package verified assets/license, test missing/corrupt assets and offline/fallback on actual deployment | Deployment gate | PHASE_4_IMPLEMENTATION.md |
| P4-10 | Skeleton overlay and accessible native controls do not establish independent screen-reader/low-vision exercise usability | Accessibility evidence gap | NVDA/VoiceOver/TalkBack and representative user checks, 200% zoom, interruption/keyboard flows | Accessibility release gate | PHASE_TEST_REPORT.md |
| P4-11 | Camera completion links only an explicitly substituted matching eligible activity for today; automatic plans exclude camera-only templates | Intentional plan boundary | Keep explicit choice, restrictions/equipment/rest checks and same-source deduplication; do not imply automatic camera prescription | Disclosure | PHASE_4_IMPLEMENTATION.md |

## Phase handoff checklist

1. Re-read this register and the phase's test report; update status only from current evidence.
2. Append stable IDs for newly found limitations; link supporting files and specify a testable closure condition.
3. Mark resolved items in the closure log; keep intentional boundaries and external prerequisites distinct.
4. At the end of all approved phases, produce a prioritized rectification plan from remaining items: release/security/privacy gates first, then core reliability/accessibility, performance/UX and optional enhancements.
5. Re-run affected regressions and live acceptance checks after fixes. Obtain separate approval for deployment, payment activation or Phase 2+ as applicable.

## Closure log

No register entries have been marked resolved by this documentation pass. Existing camera-preview and build/temp-permission defects were already resolved in their source reports and are not reclassified here as open defects.

Future closure record: `ID | resolved/accepted boundary/scoped out | date | change reference | verification evidence | remaining limits`.
