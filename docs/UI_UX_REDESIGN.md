# UI/UX redesign and depth specification

28 October 2026. Existing character identities and image assets are preserved. The chat-authorized visual update adds CSS perspective and pointer/touch feedback; it does not introduce a new character renderer or expensive WebGL scene.

## Design tokens

| Token | Light / behavior |
|---|---|
| Ink | #213c34 |
| Muted | #7b8880; confirm contrast for small text on final surfaces |
| Page | #f5f6f1 |
| Primary | #244c3d |
| Accent | #dcf198 |
| Cards | #ffffff with restrained green-tinted gradients |
| Dark surfaces | #1b2f25–#2b4534 with pale readable text |
| Typeface | Existing Geist / Arial fallback; reuse loaded fonts |
| Sizes | Body 14–16 px; supporting 11–13 px; headings responsive 30–47 px |
| Spacing | 4, 8, 12, 16, 24, 32, 48 px |
| Radius | Inputs 10–12 px; buttons 12–16 px; panels 24–28 px |
| Card depth | Small bottom edge + ambient shadow; never obscures labels |
| Perspective | 1,400 px; bounded X ±2.5°, Y ±3° |
| Motion | Press 120–180 ms; hover 200–240 ms; surface reset 320 ms; idle 5–6 s |
| Breakpoints | Existing 650/800/1050 px patterns; verify at 390, 768 and 1440 px |

## Interaction design

Dashboard targets and companion panels use layered materials and shallow depth. Pointer movement moves the light/tilt on designated cards only. The character stage keeps the same assets, with raised foreground content and a shadowed base. Buttons press downward with a shorter shadow; touch has no hover-only interaction requirement.

Never tilt camera/video, menus or active input fields. Do not put perspective on ancestors of fixed companion docks or toasts. Reset tilt on focus/blur/leave. Keep layout boxes stable. Respect calm mode and prefers-reduced-motion; keyboard users get visible focus without needing a pointer. No screen-wide zigzag design or comic/neon replacement is reintroduced.

Loading: show scoped skeletons or existing loading labels, never sample customer progress. Empty state: one clear action. Errors: keep user input and show recovery. Success: announce saved progress without automatically publishing anything.

Future component extraction: SurfaceCard, DepthSurface, PrimaryButton, FormField, LoadingSkeleton and EmptyState. The current refinement extends existing CSS/event handling instead of adding a heavy animation library.


## Delivered visual pass / verification

28 October 2026: existing characters/assets preserved. Surface depth/lighting and bounded mouse tilt extend TouchFeedback; keyboard focus resets depth, coarse pointers keep stable cards, and calm/reduced-motion disable tilt/idle movement. Card edges, progress materials, navigation selection, authentication surfaces and buttons use the shared depth treatment. Scanner/video and active form controls are excluded from tilt. No WebGL library, paid call or new dependency was introduced.

166 frontend tests passed across 28 files. Production webpack build, TypeScript and ESLint passed. Backend/database functionality was not modified or re-certified by this visual pass.

REA controlled runtime observations (temporary empty browser profiles, no customer cookies):
- Desktop dashboard at 1440×1100, evidence ev_3086d5256eec6f4d326304e5ada0b3279fa9a6f7ed389fbf6e93de0d8b11092e; no page errors. Saved `3d-dashboard-20261028.png`.
- Character button interaction changed Pip's encouragement while preserving the six character identities/level locks, evidence ev_1b65fd47b4046e832d74bb8eb3be1d30b1806eb014991f5da0b39ffd484d1ff0; no page errors. Screenshot was inspected inline; the optional separate export did not complete.
- Mobile 390×844 dark/reduced-motion capture initially exposed low-contrast hero text. Corrected the dark hero background and text, rebuilt, and rechecked: evidence ev_fcc1f18fec879e4dbac00c0a9fa452e831ba21bf6cd2c27e8f6ec4fcb623c6cc; no page errors and readable mobile rendering. Owned temporary browsers were terminated after each capture.

Pointer tilt bounds and reset behavior are covered by tests; no hardware touch-device certification is claimed. Live camera capture was not exercised in this visual pass, and its source behavior was preserved.


## Studio refresh — 28 October 2026

The earlier green palette is superseded by the ink/lavender Studio system. See STUDIO_REDESIGN_20261028.md for current tokens, responsive layout, actual interactions, accessibility controls and verification. Existing characters and feature/data contracts are retained.
