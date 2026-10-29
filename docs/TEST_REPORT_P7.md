# Phase 7 test report: social feed

Date: 29 October 2026. Branch `codex/phase-4-camera-tracking`. Windows 11, Node 24.19, Python 3.12, MySQL 8.0,
headless Chrome stable, ports 3004/8004, disposable `trackcal_phase3_test` schema. Ships **off** (`social_feed`).

**Owner decisions:**
- Public profiles and posts, Instagram/LinkedIn style, with one-way follows.
- Posts are text plus app milestones.
- Reactions show public counts, and posts take comments.
- No extra rules for under-18 accounts.

The last decision is recorded as a **launch gate (KI-36)** because of child-safety and DPDP parental-consent
obligations. Safety tools that apply equally to everyone were added: optional private accounts, block, mute, report,
auto-hide after 3 reports, a moderator queue, and rate limits.

## Results

| Area | Result | Detail |
|---|---|---|
| Flag off | **PASS** | Every social endpoint 404; the page says the feed isn't available |
| Profiles | **PASS** | Handles 3–30 chars (letters, numbers, `_` `.`), reserved names refused, unique case-insensitively; profile needed before posting or following |
| Visibility | **PASS** | One rule (`can_view`): public posts reach Discover; follower-only posts only followers; private accounts need approval (request → approve; going public approves pending requests); hidden/deleted only for the author |
| Block / mute | **PASS** | Block hides both people, ends follows both ways, prevents re-following; mute hides only for the muter and is invisible to the muted person |
| Milestones | **PASS** | Attached by reference and snapshotted by the server (title only: no weight, calories or body data); someone else's or invented milestones refused |
| Reactions | **PASS** | like/cheer/clap/hug, one per person, changeable, removable; counts per kind are public |
| Comments | **PASS** | ≤ 300 chars; deletable by the commenter or the post author only |
| Reports and moderation | **PASS** | One report per person per item; 3 distinct reporters auto-hide a post or comment; admin queue with hide / restore / dismiss / pause posting; paused accounts can't post or comment |
| Paging and limits | **PASS** | Cursor paging newest-first with no gaps or repeats; posts 20/h, comments 60/h, follows 100/h, reactions 300/h, reports 30/h |
| Data rights | **PASS** | Export includes profile, posts, comments, reactions, follows, blocks/mutes and reports made; erasure cascades. The export coverage test now also recognises `author_id`, `follower_id` and `reporter_id`, so future tables can't slip through |
| Browser | **PASS** | Two real people: post → Discover → clap + comment → author sees counts → follow → Following → report → block hides both ways; private account request/approve; desktop and 360 px; no horizontal scroll; 0 CSP violations; axe WCAG 2.2 AA clean on feed and profile |
| Privacy page | **UPDATED** | What the feed makes public and how block/mute/report/export work |

## Defect found and fixed

- **Follow failed from the browser:** "Invalid JSON". The gateway rejected POSTs with no body. Backend tests called the
  API directly and missed it; the browser journey caught it. Empty bodies are now accepted on social routes, and a
  gateway test covers it.

## Test counts

| Suite | Before Phase 7 | After |
|---|---|---|
| Backend pytest | 515 | **551 passed** (`test_social.py` 14, export coverage widened) |
| Web vitest | 267 | **273 passed** (42 files; `social.test.tsx` 6) |
| TypeScript / ESLint | pass / 0 | **pass / 0 errors** |
| Browser `e2e-p7-social.mjs` (new) | — | **14/14** |

## Before turning the feed on for real people

1. **KI-36 (launch gate):** decide, with legal advice, on parental consent or age limits for under-18s.
2. **KI-37:** name moderators and a response time, and add a keyword pre-screen.
3. **Wording:** the feed copy and community rules (what's not allowed: harassment, hate, pro-eating-disorder content,
   body shaming) should be published and linked from the composer.
