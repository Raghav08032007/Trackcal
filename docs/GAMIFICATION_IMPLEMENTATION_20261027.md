# TrackCal Play — implementation and verification

27 October 2026. First gamification release implemented locally; not a production launch or a 10/10 certification.

## Delivered

- `/play` has an original outlined, colorful interface, raised buttons, transitions and the CSS 3D seed mascot Pip. Inspiration comes from Angry Toast's public visual direction; no reference artwork, character or game code was copied.
- Signed-in users explicitly opt into a server-owned XP ledger. Guest Label Detective practice grants no XP. Existing journal, planner and nutrition report remain linked and usable.
- Daily quests award 10 XP each for today's explicitly reviewed meal, a feasible generated plan and completing Label Detective: 30 daily XP. Three distinct reviewed days in the current week grant a separate 25 XP weekly bonus.
- Every 250 XP advances a level. Garden cosmetics unlock at levels 2, 5 and 10. Four participation badges and current/best streaks derive from server records.
- Streaks follow the selected IANA timezone, fixed after initialization in this release. Today's or yesterday's participation can sustain the current streak; refresh loads new-day progress.
- Label Detective draws three questions from five curated nutrition-label questions, checks answers on the server, provides explanations and allows learning retries. Sessions expire after 15 minutes, allow up to ten incorrect submissions and are limited to twelve starts per hour.
- Duplicate rewards are prevented with unique ledger keys and locked database reads. Live concurrent review requests both returned 200 with awards [0, 10]. A forged XP field did not change the server award. Cross-account access and replay protection were checked.
- Calm mode, reduced motion, mobile layout, keyboard controls, dark theme and navigation entry points are included. No new game-engine dependency was needed.

## Data and deployment

Reviewed meals save an explicit private server snapshot; local journal deletion does not reverse historical participation XP. These entries are self-reported, not verified nutritional truth. Imported/demo/sample entries are excluded from the review picker; imports do not automatically earn rewards. No points reward restriction, weight loss or excessive activity.

Account export includes the owner's adventure profile, reward ledger, reviewed snapshots and game-session metadata without answer keys. Existing account closure deactivates access; it does not promise immediate erasure. No public journal sharing or leaderboard was introduced.

Apply `backend/migrations/20261027_adventure.sql` or the explicit schema bootstrap before running the new API against an existing installation. The four additive tables were created in the local MySQL database. Both dependency manifests pin `tzdata==2026.5` for Windows timezone support. Deploy the backend and frontend together; planner rewards require the new tables.

## Verification

- Frontend: 146 tests across 24 files passed; production webpack build, TypeScript and ESLint passed. Four standalone meal-analysis checks passed.
- Backend: 166 application tests passed (672 dependency/deprecation warnings). An initial unscoped pytest command also collected the separately cloned Mealie runtime and failed on its optional dependency; rerunning the intended `pytest tests` application scope passed.
- Live API: simultaneous duplicate reviews, ownership protection, server scoring, forged XP, replay cap and persisted summary passed.
- Browser: guest practice, actual test-account login, persisted 20 XP and one-day streak, a completed three-question round with zero duplicate XP, mobile 390px layout, dark theme and calm mode verified.
- Disposable browser account deactivated and its temporary credential file removed. The user account was not provisioned or altered.
- Screenshots: `trackcal-play-verification.png` and `trackcal-play-mobile-verification.png` in this directory.

## Deliberately unfinished scope

Pantry Puzzle and Garden Dash are labeled PLANNED. Rest-day shields, public/social competition, offline reward reconciliation and a redesign of every existing screen remain future work. The original design plan is broader than this first release; its proposed practice-game bonus is not implemented and the actual daily cap is 30 XP.

Production domain/deployment and SMTP remain deferred by the user. Payment-provider setup, deployment validation, real-world nutrition accuracy evaluation and the existing release gates still apply. This release establishes tested participation mechanics; retention and commercial readiness require customer evidence.


## Six character companions — 27 October follow-up

Added Pip (seed, gentle encouragement), Nova (star, curiosity), Milo (bear, kindness), Luna (owl, reflection), Rio (fox, play) and Sage (turtle, patience). All six are freely selectable in `/play`. Each uses original CSS artwork with shading, distinct silhouettes, tap-to-wave animation and its own scripted encouragement. No external image service or new dependency is required.

Characters show server-derived level, XP, streak and level progress, with a flower at level 2, crown at level 5 and sunshine at level 10. “Help me choose” recommends the first unfinished quest, with a direct action link. Completed quests lead to a rest-positive message. Guest guidance offers practice rather than invented XP. Quest notices trigger character congratulations; clicking encouragement or guidance remains usable afterward.

Choice is a workspace-scoped local preference, included in existing validated backup/restore flows and accepted by the server workspace allowlist. It is not a separate server profile field or an automatic cross-device preference. Switching characters never grants or resets XP. Calm/reduced-motion rules cover animations. Encouragement is scripted, not an AI conversation, clinical advice or scheduled notification.

Verification: all 149 frontend tests across 25 files passed, including three new character tests for selection, backup validation, guidance, growth and completed/guest states. Production webpack build, TypeScript and ESLint passed. Three backend account tests passed. Live browser selection of Sage, tap interaction and guest quest guidance were confirmed; screenshot: `character-companions-verification.png`. The local web and API processes were restarted with the update.


## Detailed artwork, page following and earned unlocks

This update replaces the earlier all-free selection rule: Pip is available immediately, Nova unlocks at 50 total XP, Milo at 150, Luna at 250, Rio at 500 and Sage at 1,000. All are earned without payment. Server adventure summaries now include `unlocked_companions`, derived from the existing reward ledger. No migration or manual XP adjustment is needed. The frontend uses the server list and checks eligibility again before resolving a saved selection; restoring a locked preference falls back to Pip. Locked cards remain previewable and explain their requirement and remaining XP.

Original detailed 3D-style raster artwork replaces the geometric CSS figures. These are textured illustrations animated with CSS, not rigged real-time 3D models. Pip's hero artwork is updated too. Next Image serves resized assets. Active assets are in `frontend/web/public/characters`: pip-v2.png, nova-v2.png, milo-v3.png, luna-v2.png, rio-v2.png and sage-v2.png. The earlier Milo variant remains as an unused source variant.

Companions breathe/bob, react on tap and appear in a small floating dock when the character section leaves view. Scrolling gently rotates the dock character. The dock offers encouragement and a next-quest link; it can be dismissed or disabled using the follow checkbox. It follows within `/play`, not across other routes. Calm mode hides the dock and reduced-motion settings suppress animated movement.

Verification: 152 frontend tests across 25 files passed; nine backend adventure tests passed, including exact unlock boundaries. Production webpack build, TypeScript and lint passed. Browser checks confirmed locked Nova preview, Pip remaining selected, the page-follow dock and its encouragement interaction. Screenshot: `companion-follow-verification.png`. No real account was changed or XP granted for testing.

Artwork was generated with the built-in image generation tool. Prompts and asset provenance are recorded in `CHARACTER_ART_PROMPTS_20261027.md`. Production deployment and the previously deferred launch gates remain outstanding.


## Reference crew, Comic Day / Neon Night and zigzag motion

The user's supplied cartoon crew supersedes the earlier 3D-style asset set. Pip is now the yellow monkey, Nova the purple cyber raccoon, Milo the cyan lion, Luna the lime spotted leopard and Rio the blue/orange street bear. Sage remains a turtle, newly illustrated in matching streetwear to keep six companions. Stable IDs, names and XP thresholds are unchanged.

Six transparent, square illustrations were generated from the attached reference with the built-in image generation tool, visually inspected and saved as `frontend/web/public/characters/{id}-comic-v1.png`. The same files and image containers are used in both themes, including the hero, character selector, interactive companion and following dock. The selected, eligible character also controls the page accent color. No separate theme-specific character identities or progress exist.

The `/play` theme bar switches between Comic Day (warm yellow, purple type and outlined panels) and Neon Night (deep navy/purple, cyan and lime). All Play sections, game forms, progress cards, badges, previews and controls use the selected palette. These are Play-specific visual themes; the other nutrition/account routes retain their existing appearance control. Theme selection and floating preference are saved per workspace and included in validated backup/restore, with matching API allowlist support.

Hero and companion artwork follow gentle zigzag keyframes. Once the user scrolls beyond the companion section, the floating dock travels a bounded zigzag path; smaller mobile movement keeps it inside the viewport. Hovering or focusing the dock pauses travel to make its controls easier to use. Pause floating stops animated motion; the existing follow checkbox/dismiss button, calm mode and reduced-motion settings remain available. No earned XP or unlock requirement changes when changing themes or motion settings.

Verification: full frontend suite 153 passed across 25 files, ESLint and production webpack/TypeScript build passed. Thirteen targeted character/adventure checks passed after the final observer refinement. Three backend account tests passed, including private backup round-trip of theme, character and motion values. Browser checks covered both palettes, identical reference artwork, locked preview, theme controls and readable game/companion areas. Screenshots: `crew-comic-theme-verification.png`, `crew-neon-theme-verification.png` and `crew-neon-characters-verification.png`.

No production publication, real-account edits or reward grants were performed. Earlier launch limitations still apply.


## User-requested design restoration

Restored the previous textured 3D-style character artwork and original Play palette. Removed the Comic Day / Neon Night controls and zigzag keyframes. XP unlocks, private progress, calm/reduced-motion support and the earlier following companion remain. Reference-style assets are preserved as unused variants. Existing theme/motion backup keys remain accepted for compatibility but no longer affect rendering.


## Companion-guided plans and check-ins

Kept the restored original design and 3D-style assets. Added a daily participation plan derived from incomplete server quests, three effort levels, gentle/ready check-ins, focus view and direct journal/Smart tools/game links. Completed days offer rest; guests get a practice path. No XP is granted for plan interactions and no medical meal prescription is invented. Added responsive plan cards, staggered reveal, subtle hover depth and retained calm/reduced-motion support. Full frontend suite: 155 passed; production build, TypeScript and lint passed. See [feature inventory and proposed monetization](FEATURES_AND_MONETIZATION_20261027.md) for product boundaries and suggested experiments.

Browser follow-through: guest gentle-start check-in opened the plan, changed the character response and selected one-small-step pace. Steady progress pace changed correctly. Saved screenshot `companion-daily-plan-verification.png`. No account or reward was fabricated for this preview.


## Progress-first dashboard and level unlocks

Home now centers daily nutrition references, server quest progress, full-day task streaks and a companion. One character unlocks at each level from 1 through 6; the earlier 50/150 XP thresholds are superseded. XP and old meal-review streaks are retained. Touch-origin feedback is shared across buttons and links. Final verification: 168 backend tests, 158 frontend tests, build, TypeScript and lint passed; live browser target updates and reward API smoke passed. See [daily progress release and market assessment](DAILY_PROGRESS_AND_MARKET_REVIEW_20261027.md).
