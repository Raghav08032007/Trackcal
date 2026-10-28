# TrackCal Studio — UI/UX redesign and user test drive

28 October 2026. Extends the existing Phases 0–4 application. No new backend schema, paid service, replacement stack, deployment or Phase 5 work.

## Visual direction

Ink canvas, lavender materials, coral/mint highlights, restrained card depth and large editorial headings replace the muted green dashboard. Light and dark use the same token system. Existing six character images/identities remain. The character stage uses CSS perspective, bounded pointer tilt, dimensional orbits/spheres, layered shadows and gentle animation; it is **3D-style presentation with raster characters**, not a new articulated WebGL model.

Primary tokens: ink #24243f, light canvas #f4f3fa, white surfaces, purple #6350c5, lavender #d8ccff, coral #ff8f76, mint #d9f8bb; dark canvas #141522 and surfaces #202133. Shared CSS covers dashboard, cloud nutrition, manual/camera workouts, plans, account/authentication, game surfaces, guide and footer. Legacy dark !important colors are deliberately overridden within the Studio theme. Inputs/focus/error behavior and existing responsive control sizes remain.

## Interaction and navigation

- Replaced oversized shortcut blocks with a dedicated workspace rail/phone navigation rows. Food tools retain all six existing destinations. A Today action returns to the daily overview; tool selection scrolls to the selected workspace. Each selected tool has a proper page heading.
- New daily character hero links directly to cloud nutrition, camera movement, companion customization and the test drive. Displays actual server journey XP/quest state or honest guest labels; no sample progress, fabricated counters or client XP award.
- Reference nutrition and device journal data remain separate from the cloud diary, as in Phase 3. The guide explicitly explains this existing boundary; no silent import/merge or nutrient/reward calculation change.
- Added consistent secondary-page navigation and removed redundant page-level branding where the shared navigation already supplies it. Footer keeps themes/help/data controls reachable outside the fixed desktop rail.
- Pointer/touch feedback uses existing lightweight infrastructure, no new animation package. Inputs, camera previews and live editors do not tilt. Mobile character placement is checked not to cover copy; camera companion remains in reserved space.
- Existing home/play calm preference now also drives a global Reduce motion checkbox and HTML motion attribute. Reduced motion stops animation and transitions across routes even if the companion is disabled. OS preference is respected. No new audio, notification loop, random reward, loss-aversion prompt or reward for excess exercise/intake restriction.

## User testing guide

Open `/guide` from Guided test drive in the footer, the desktop introduction card or homepage test-drive link. It works without an account; the actual private feature pages request sign-in where needed. Six cards explain actions and observable outcomes:

1. Appearance, motion and navigation.
2. Account/onboarding/preferences/personal plan persistence.
3. Food lookup, reviewed meal amounts/corrections, saved meals and source boundaries.
4. Familiar manual workout, sets, pause/resume, completion and history.
5. Real-device camera permission, positioning, pause/resource shutdown, correction/confirmation and history.
6. Optional quests, actual XP/badges/character unlocks, companion preferences and account/data controls.

Feature links open a separate tab so the checklist can remain open. Checkmarks are visit-local notes; they do not award XP, prove a test automatically passed or promise cross-device persistence. Reset clears them. Users should record page/action/expected/actual/browser/device when reporting a problem, without passwords, API keys or private measurements. Tests can use a dedicated account they control. Real camera estimates remain uncertain, not technique or medical-safety assessments.

## Files

`frontend/web/src/app/studio.css`; shared layout/page; app-design, daily-progress-hub, studio-navigation, testing-guide, theme-control and touch-feedback components; `/guide` route. Tests: studio-design.test.tsx and e2e-studio.mjs, plus all previous-phase suites/journeys. No character replacement or new application dependency.

## Verification

Full backend regression: **274 passed**. Full frontend regression: **216 passed / 38 files**, including five guide/navigation/global-motion tests. Separate Node meal-analysis tests: **4 passed**. Total automated tests: **494**. Production build/TypeScript passed, 29 pages. Full lint: zero errors and five existing warnings.

New Studio browser acceptance: **13 checks**, desktop 1440×1100, tablet 768×1024, mobile 390×844; actual depth interaction, real palette colors, mobile character/copy clearance, all six tools, native appearance/motion settings and interactive guide/reset. Existing browser journeys were rerun: Phase 2 seven checks, Phase 3 seventeen checks and Phase 4 eighteen checks. See their latest evidence and PHASE_TEST_REPORT.md for final outcomes.

Initial regression caught missing H1 headings after hiding the overview on tool pages; fixed in the actual interface, with the original test retained. Visual inspection caught legacy dark green !important rules and mobile character/copy overlap; corrected and added explicit browser assertions. No failing application test was removed.

Evidence: [Studio checks](studio-browser-evidence-20261028.json), [desktop](studio-desktop-20261028.png), [phone dark](studio-mobile-20261028.png), [tablet](studio-tablet-20261028.png), [guide dark](studio-guide-dark-20261028.png). Screenshots contain guest/synthetic information only.

Physical touch devices, independent accessibility/user research, market-wide uniqueness, engagement/retention outcomes, representative camera/nutrition accuracy and production readiness are not established by this design pass. Existing limitations/release gates remain in LIMITATIONS_REGISTER.md. The design aims for clarity and enjoyable healthy participation, not a scientific claim about dopamine or an addictive engagement mechanism.
