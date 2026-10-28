# Shared floating companion — Phase 1

Implemented 28 October 2026 in `frontend/web/src/components/journey-companion.tsx`, mounted under the account session in the root layout. Reuses the existing six detailed raster characters. Accessories are original inline SVG; movement/depth use lightweight CSS, with no new animation dependency or 3D renderer.

Authenticated users with an initialized journey see a minimized dock on `/`, `/play`, `/tools`, `/routine`, `/progress`, `/account`. Guest/auth/legal pages have no progress dock. No new camera overlay is mounted: the small corner dock can be minimized, moved left/right or disabled to keep the scanner accessible. The legacy Play traveler is hidden when this dock exists.

Click/tap expands. Escape or the minimize button closes. The panel contains authoritative XP and level progress, contextual scripted guidance, all achievement states, rest planning/history, character/accessory selection, mute, calm motion, protection and dock controls. Locked choices are disabled in the UI and enforced by the API. Preferences persist on the server; calm mode is account-scoped device storage, included in existing backup rules. Disable can be reversed on Play. The dashboard customization link opens the panel on Play.

No sound is played. Quiet announcements suppress achievement announcements; controls retain normal accessibility. New earned badges produce a small six-second message, with a 60-second cooldown while mounted. Initial history is not replayed. Navigation uses real links and does not award XP. Motion respects OS reduced-motion and calm mode. Responsive panel height scrolls within the viewport, and mobile uses a smaller character. There is no drag-only control; dock side is keyboard-operable.

Progress resets on account changes and foreign-account mutation events are ignored. Summary refreshes on browser focus. Existing dashboard/Play consumers still fetch their initial summaries separately; a central request cache is a future optimization, not a completed claim.

Limitations: no voice/LLM chat, arbitrary dragging, physics or real articulated 3D skeleton. Encouragement is scripted, not medical advice. Physical camera/device coverage remains separate from this feature. See PHASE_TEST_REPORT.md for verification evidence and remaining production prerequisites.

## Phase 3 extensions

The same root companion now covers /nutrition and /workouts, with food-source/portion guidance, session/library/history links and real achievement/level/cosmetic milestone notices. No second companion was added. Character assets remain unchanged. Idle movement is a gentle bounded translate/rotation; a short optional achievement reaction replaces it temporarily. OS reduced-motion and the account's calm setting suppress motion; muted preferences disable celebrations/announcements. No audio is played. The control label explicitly describes that behavior.

Typography increased across the app, including older pixel-sized captions: 18px base desktop, 17px mobile and approximately 14–15px supporting text. New wellness cards use existing green depth materials and pointer feedback; active editor fields are not tilt surfaces. Dock side/minimize/disable are preserved. Corner placement may overlap noninteractive content at some scroll positions; further physical-device/active-keyboard coverage stays in the limitations register.

Verified: real CSS idle motion in desktop browser; motion disabled under emulated OS preference on mobile/tablet; real central achievement reaction after a diary reward; existing settings/account-isolation tests retained. No claim of articulated skeletal 3D motion or universal device coverage.


## Phase 4 camera assistance

The same existing companion now covers `/workouts/camera`. It is portaled into reserved space above the camera stage so the character and expanded settings cannot obstruct the body view or controls. No second character instance, microphone or renderer. Setup, active, low-visibility transition and successful-save messages are scripted, with no per-frame screen-reader announcements. Explicit display/feedback options and the existing mute/minimize/disable/dock-side/calm/OS reduced-motion settings remain. Repeated low-confidence frames do not dispatch repeated companion events until a valid frame is seen again. Achievements still come from authoritative central reward summaries; animation is optional.

Browser checks wait for portal placement before measuring rectangles; early hydration does not establish final layout. Mobile/tablet reduced-motion layouts and real completion-triggered shared celebration were checked with synthetic accounts. Physical camera/assistive-technology interaction is NOT VERIFIED.
