# TrackCal Play — design and implementation plan

Status: original proposal, 27 October 2026. The first release has now been implemented; see [implementation and verification](GAMIFICATION_IMPLEMENTATION_20261027.md) for delivered scope, actual reward rules and remaining work. The proposals below are not all shipped features.

## Direction

Build an original nutrition quest experience inspired by Angry Toast's visual energy: bold type, thick dark outlines, raised pill buttons, vivid color blocks, mascot-led storytelling and a game-selection hub. Its current homepage includes four games, a mascot and interactive bundle building: https://www.angrytoast.co/. These are observed reference patterns, not evidence that its game logic or rewards are reusable. Do not copy its characters, artwork, slogans or game code.

Working concept: **TrackCal Play — small habits, bigger adventures.** An original pea/seed mascot grows a colorful kitchen garden as users practice tracking and planning. A calm display option preserves a simpler dashboard. Game progress never represents health, nutritional adequacy or medical outcomes.

## Experience and navigation

Keep food logging one tap away. Main navigation: Today, Journal, Quests, Play, Progress. Recipes, planner and shopping remain reachable through their existing tools.

- Today: existing nutrition summary plus three optional quest cards, small XP bar and streak chip. Log meal remains the primary action.
- Quests: explicit conditions, deadline/timezone, progress, reward and completion status. Only a few active challenges at once.
- Play: short, optional educational games; normal food tracking never requires playing.
- Progress: separate Nutrition and Adventure views. Preserve the current nutrition chart/table and printable report. Adventure shows XP, level, earned badges, activity calendar and personal quest map.
- Profile: original avatar/customization, sound toggle, reduced motion, calm mode and private progress controls.

Design tokens: warm ivory #FFF8E8, dark ink #18221B, leaf green #B9EE59, orange #FF9A55, sky blue #9AD9FA. Validate final contrast before adoption. Thick 2–3 px borders, offset 4–6 px shadows, large headings and spacious form fields. Use CSS/SVG depth for the mascot and cards; keep essential text outside transformed/canvas layers. Hover lift, press compression and restrained reward celebrations; no continuous autoplay effects or flashing. Keyboard, touch, screen readers and reduced motion must work.

## Initial reward rules

These are proposed values for a pilot, not proven engagement settings.

| Action | XP | Award limit |
| --- | ---: | --- |
| First reviewed meal saved today | 10 | Once per account/day |
| First recipe or meal-plan task completed today | 10 | Once per account/day |
| Finish daily learning quiz, including reviewing explanations | 10 | Once per account/day; no speed bonus |
| Finish a practice game | 5 | Once per account/day across practice games |
| Finish weekly consistency quest | 25 | Once per account/week |

Regular daily XP is capped at 35. Weekly bonus is separate and capped at 25, so progress remains predictable. Every 250 XP advances one level. Cosmetic rewards at levels 2, 5 and 10; XP is not spendable, cash, medical credit or a promise of monetary value. Keep the first version to one points system; add a second currency only if user research justifies it.

Do not award points for lower calorie intake, weight loss, excess water, extra exercise, purchasing AI scans or submitting endless duplicate meals. A neutral hydration check-in can be a quest without rewarding quantity. Avoid ranking people by bodies or food choices. User-entered meals remain self-reported; a confirmed application event is not verified nutrition.

## Streaks and challenges

- A daily streak means one qualifying reviewed meal saved, not meeting a calorie/weight target.
- Use an account's saved IANA timezone, UTC server timestamps and explicit local dates. If yesterday qualified and today is unfinished, show the streak as still available today.
- Introduce a weekly alternative: three active days out of seven. A missed day does not erase earned XP, levels or badges.
- A clearly labeled rest-day shield may preserve continuity once earned after seven qualifying days. Protected days never inflate actual activity counts. No paid streak repair or guilt messages.
- Backups, imported history, changing the device clock, repeated edits and repeated game submissions cannot mint new competitive rewards.
- Initial quests: log on three different days; review one food estimate; prepare a shopping list; save a recipe; finish a label-reading quiz. All conditions must be supported by real product events.
- No public leaderboard in the initial release. Later social challenges require opt-in pseudonyms and no sharing of food/weight records by default.

## Games

1. **Label Detective — first release.** Three short rounds using curated synthetic labels: serving-size arithmetic, per-100g versus per-portion interpretation and finding a nutrient value. Show explanations, accept retries and offer untimed keyboard controls. Server chooses the challenge and validates answers. No AI generation is needed for scoring.
2. **Pantry Puzzle — next release.** Build a shopping basket from fixed fictional prices/stock under a budget. Reuse reviewed planning rules where useful. Score budget reasoning and avoiding duplicate purchases; do not claim that the fictional basket is a personalized diet.
3. **Garden Dash — optional arcade release.** A short original mascot runner that collects garden supplies. Session duration and play cannot increase health scores. Equal XP for completing an accessible turn-based alternative. High scores stay personal until anti-cheat and consent are implemented.

Games reward limited completion, not unlimited play time. Food logging remains available when the game engine, graphics or network is unavailable.

## Architecture and current-code constraints

TrackCal currently stores much of the web journal locally and backs it up as JSON snapshots. Its web MealLog shape does not have a stable per-entry ID; backend MealLog already has an ID. There is no XP ledger, streak engine, challenge state or game session model. Secure rewards cannot simply trust localStorage totals or restored snapshots.

First add stable client event/meal IDs with a non-destructive migration. Bridge qualifying web actions to authenticated backend mutations; use the existing backend meal records where practical. Keep guest progress device-local and label it practice progress. Claim only validated eligible events when an account is linked; never bulk-convert imported history into rewarded activity. Preserve existing backups and offline journal behavior.

Proposed additive tables:

- reward_events: user, event/source ID, rule version, local day, delta, reason and creation time; immutable audit trail and unique idempotency key.
- adventure_profiles: user, IANA timezone, display preferences and cached totals derived from the ledger.
- quest_instances: user, definition/version, period, completion and claimed reward identity.
- game_sessions: user, curated challenge/seed, nonce, expiry, submission/result and awarded reward identity.
- user_badges: unique user/badge, earned timestamp and qualifying event.

Unique constraints enforce once-per-day/week rewards; transactional writes prevent double claims across tabs/devices. Server calculates XP, challenge completion and streak dates. Do not accept a browser-supplied XP number or arbitrary unlock flag. Failed/replayed requests return the existing result without a second award. Support audit/reversal events for removed qualifying records; legitimate corrections must not mint extra XP. Limit concurrent/expired game sessions and request rates. Validate reward computation independently of cached totals.

Proposed protected API: GET /gamification/summary, GET /gamification/quests, POST /gamification/quests/{id}/claim, POST /games/{slug}/sessions, POST /games/sessions/{id}/submit. Application services emit eligible events after successful journal/planning operations; do not expose an unrestricted award endpoint. Explicit cross-account, duplicate, concurrent and expiry checks apply.

Offline actions queue stable IDs with account binding. Pending rewards are visibly pending until accepted. Untrusted offline dates/history cannot override server-confirmed competitive progress. Test reconnect, wrong-account queues, conflict resolution and timezone boundaries. A user remains able to log food offline without game rewards.

## Open-source choices

- Existing React, Next.js, CSS/SVG and Dexie are sufficient for the first quiz, quest cards, simple mascot and offline queue. Avoid unnecessary dependencies.
- Phaser: https://github.com/phaserjs/phaser — MIT; candidate for the later runner/puzzle engine. Load only on game routes and destroy scenes/listeners on exit.
- canvas-confetti: https://github.com/catdad/canvas-confetti — ISC; optional brief celebrations, honoring reduced motion. A CSS-only celebration is sufficient initially.
- Repository names/licenses were checked on 27 October 2026. Pin and audit selected versions before installation. No new game dependency has been installed in this planning pass.

## Execution sequence and acceptance gates

1. **Design prototype.** Define tokens and original mascot; produce desktop/mobile Today, Quests, Play and Progress screens. Gate: primary logging action remains obvious, keyboard flow works and key states have approved designs. Keep existing functionality reachable.
2. **Progress foundation.** Stable event IDs, additive schema migration, reward ledger, timezone-aware streaks, guest isolation and authenticated summary. Gate: repeated/concurrent calls cannot duplicate XP; backup restore/import cannot mint rewards; no existing data loss.
3. **Habit quests.** Add the small daily/weekly set, real-action event hooks, XP/level UI, badge cabinet and forgiving streak display. Gate: eligible action → one server reward → reload/other-device consistency works end to end.
4. **First game.** Ship Label Detective with curated content and validated sessions. Gate: full keyboard/touch play, explanation/retry, expiry/replay/rate limits and equivalent accessible mode pass.
5. **Visual rollout.** Apply the new design system to remaining core screens after interaction tests. Lazy-load optional graphics, verify contrast/dark mode/reduced motion and test on actual low/mid-range phones.
6. **Pilot and extend.** Observe a consenting pilot before building more games. Add Pantry Puzzle, then Garden Dash only if habit utility and repeat use justify the work. No guaranteed retention lift is assumed.

The first deployable slice is phases 1–4: original visual system, XP/streaks, a few real quests and one complete game. Three unfinished games would be weaker than one reliable end-to-end game. Production hosting/SMTP/security gates remain separate and are not solved by gamification.

## Required tests and measurement

Test day/month/year boundaries, DST, timezone changes, today's unfinished streak, protected versus actual days, reward caps, duplicate/replayed events, edits/deletes, concurrency, import/restore, guest/account switching and offline reconciliation. Test session nonce/expiry, forged scores, repeated quiz submissions, account isolation and unavailable game assets. Preserve the existing regression suite.

Browser journey: log a meal → see exactly one award → open quest → complete quiz → earn capped reward → reload → retain progress → retry submission → no extra reward. Test reduced motion, sound off, keyboard-only, screen reader, touch, 200% zoom and real devices.

Measure activation, reviewed meals on distinct days, weekly quest completion, D7/D30 return behavior, game-to-useful-action conversion, errors and reported enjoyment/pressure. Separate game-only activity from nutrition-tool retention. Compare with the current baseline; do not invent targets or claim improvement without sufficient cohort evidence.

Keep core tracking, data export and basic habit progress free. Any future paid theme packs, coach-created quests or advanced planning need separate pricing research and the unfinished billing implementation. Do not sell chances, loot boxes, competitive advantages or streak repairs.
