# TrackCal home and companion guidance — 28 October 2026

This change reorganizes the existing product without rebuilding its stack, changing its storage model, or adding reward rules.

## What changed

- Replaced the crowded root view with a daily progress hero and six clear destination cards for nutrition, workouts, camera studio, personal plan, quests/companions, and food scanning.
- Kept the global footer controls. The app has no new navigation bar or sidebar; secondary pages use compact **All features** and **Guided test drive** action buttons.
- Moved secondary food tools into a collapsed “More food tools, reminders & your data” section. Food destinations open their own reloadable pages: `/scanner`, `/barcode`, `/describe`, `/food-library`, `/journal`, and `/recipes`.
- Each food page begins with its title, a goals button, and a collapsed “Choose another food tool” button group. Scanner consent and upload controls are grouped under the scanner heading so the privacy choice remains visible and understandable.
- Added the optional Pip/companion guide with “Show me how”, “Why is this useful?” and “What next?” views. It explains concrete steps, benefits, available destinations, and—when signed in—the next server-reported companion milestone. Reading help and opening pages do not award XP.
- Preserved server-validated character unlock levels, XP rules, account-scoped progress, camera permission behavior, nutrition flows, and existing character art. Locked character preferences fall back to an actually unlocked character.
- Simplified the expanded floating companion by removing repeated page copy and collapsing achievements. Exercise tracking keeps its live camera guidance.
- Fixed offline journal page sizing and heading wrapping at narrow viewport widths; added a short Pip guide to the offline form. The journal continues to write only to the device guest journal.

## Verification

- Backend: **274 passed** using the isolated `trackcal_phase3_test` database.
- Frontend: **221 passed across 39 test files**.
- Standalone meal-analysis tests: **4 passed**.
- Production browser: **14 passed** across desktop, 320px and 390px mobile emulation; six food destinations; companion how/why/next; offline journal at 320px and 390px. No page errors or horizontal overflow were observed.
- TypeScript: passed. Production Next.js webpack build: passed; all **35 app routes** were generated.
- ESLint: **0 errors, 5 existing warnings** (camera ref cleanup, companion effect dependency, nutrition unused import and image element, wellness test unused import).

Browser evidence: [studio-browser-evidence-20261028.json](studio-browser-evidence-20261028.json). Captures: [desktop](ux-home-desktop-20261028.png) and [320px mobile](ux-home-mobile-20261028.png).

## Limits

The browser run uses synthetic guest sessions and viewport emulation. It does not certify physical phones, assistive technology, live camera hardware, rep-counting accuracy, email delivery, or public production behavior. Existing unresolved items remain in [LIMITATIONS_REGISTER.md](LIMITATIONS_REGISTER.md). No database schema or reward behavior changed, and Phase 5 was not started.
