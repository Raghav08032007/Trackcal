# Step 5: Gen Z 3D redesign and living characters — 29 October 2026

Owner's direction: "CSS 3D + animated art" (not WebGL), more attractive for a Gen Z audience, characters that move and are interactive, with polished text and transitions everywhere. Existing character art, features and data are unchanged.

## What changed

### Design layer (`src/app/theme.css`, loaded last, built on the existing `--tc-*` tokens)

| Element | Before | Now |
|---|---|---|
| Background | Flat | Soft colour mesh (lavender, lime, coral), adjusted for dark mode |
| Headings | Mixed weights and fonts per page | One heavy display style: Geist Variable 850, tight tracking |
| Cards (`account-card` ×71, wellness and Play cards) | Mostly flat white | "Clay" 3D surfaces: rounded, inner highlight, layered edge and soft drop shadow; hover lift on interactive cards |
| Primary buttons (`account-primary` ×45, `gate-primary`, `play-button`) | Flat | Violet gradient with a 3D edge that presses down when tapped |
| Secondary buttons (`account-secondary` ×57, `gate-secondary`, `destination-button`) | Thin outline | Chunky outline with a soft edge and press effect |
| Inputs | Mixed | Rounded, 2 px border, glowing violet focus ring |
| Navigation | Plain bar | Glass tab bar (92% opaque, blurred); the active tab icon pops and glows; the active section pill gets the 3D edge |
| Pages | Instant swap | Content rises in on load; cross-page View Transitions where supported (Chrome/Edge; other browsers navigate instantly) |

### Living characters (`src/components/living-characters.tsx`)

Every character image (`/characters/*.png`), on any page, present or future:

- **Idle:** a gentle breathing float, with staggered timing so characters don't move in sync.
- **Look:** tilts toward the mouse pointer (up to about 14°).
- **Tap:** hops, sparkles burst from the tap point, and a short cheer bubble appears ("High five!", "Let's go!" and others).
- **XP earned:** every visible character jumps and celebrates with confetti. A new `trackcal-xp-awarded` event fires from the adventure, personalization and wellness clients only when the server awarded XP.

It uses the individual `translate`, `scale` and `rotate` CSS properties, so it combines with the existing character animations instead of overriding them. The decorative bubbles and particles are hidden from screen readers.

### Layout cleanups

- Removed the redundant brand-and-back-link headers on Account, Help, Progress, Reminders and Smart tools (the app header already shows both). The sign-in screens keep their back link because they have no navigation.
- Play's "Calm mode" control is aligned with the page content at every width.

## Motion and accessibility

All new animation is off when the system "reduce motion" setting is on, when TrackCal's "Reduce motion" is ticked, or when a calm mode is on. Verified in Chromium:

| Setting | Idle animation | Turn toward pointer | Tap reaction | Effects |
|---|---|---|---|---|
| Full motion | `lc-idle` running on all 9 characters on Play | yes | hop + "High five!" + 10 sparkles | yes |
| Reduced motion | none | none | none | none |

The page-entry animation does not keep a lasting `translate` on `<main>`, which would otherwise capture fixed-position modals inside pages.

## Verification

- Web: **177/177** vitest (new: 5 living-character tests covering adoption of new images, tap reaction, celebrating only when XP is awarded, reduced motion and cleanup), TypeScript, lint 0 errors.
- Browser (Chromium, test schema): studio 14/14, privacy 16/16, feature journeys 23/23, phase 3 journeys 17/17, phase 4 camera 18/18 (SIMULATED camera), all 27 routes and the 404 page clean at 360 px.

## Not verified

Real phones (touch feel, frame rate and battery with many animated characters on low-end devices), Safari and Firefox (View Transitions fall back to an instant change), and screen-reader listening tests.
