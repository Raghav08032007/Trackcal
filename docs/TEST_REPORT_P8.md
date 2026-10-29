# Phase 8 test report: communities

Date: 29 October 2026. Branch `codex/phase-4-camera-tracking`. Windows 11, Node 24.19, Python 3.12, MySQL 8.0,
headless Chrome stable, ports 3004/8004, disposable `trackcal_phase3_test` schema. Ships **off** (needs both
`communities` and `social_feed`).

**Defaults chosen**, following the owner's open, public Phase 7 choices:
- Any member with a feed profile can create up to 5 communities.
- Communities are public (anyone can read and join) or private (approval needed; posts visible to members only).
- Roles are owner, moderator and member.
- Community posts appear only inside their community.
- New communities start with TrackCal's kindness rules.

## Results

| Area | Result | Detail |
|---|---|---|
| Flags | **PASS** | 404 unless both flags are on |
| Create | **PASS** | Name 3–80, address 3–40 (lowercase, single hyphens, reserved names refused, unique); 5 owned per person with a clear message, then a daily rate limit |
| Public | **PASS** | Readable before joining; posting needs membership; search by name/description and category; "Your communities" |
| Private | **PASS** | Outsiders see the cover only; posts, reactions and comments refused (the feed's visibility rule now knows communities); request → moderator approves; opening up a private community admits pending requests |
| Separation | **PASS** | Community posts never appear in Following, Discover or profiles |
| Roles and bans | **PASS** | Only the owner changes roles or hands over; moderators approve, remove and ban; bans survive "leave"; the owner can't be removed and can't leave |
| Moderation scope | **PASS** | Community moderators see and act on reports only for their own community's posts and comments (other communities → 404/403); site admins everywhere |
| Archive | **PASS** | Owner only; archived communities stop taking posts and leave Discover |
| Data rights | **PASS** | Owned communities and memberships in the export; erasure cascades |
| Migration 0009 | **PASS** | Dry run clean. The downgrade deletes community posts first, so dropping the column can't turn private community posts into public feed posts |
| Browser | **PASS** | Two people, desktop and 360 px: create private → request → approve → post, hug, comment → report → moderator hides → ban; posts stay out of Discover; 0 CSP violations; axe WCAG 2.2 AA clean |

## Defects found and fixed

1. On phones, the five moderator tabs pushed the page 172 px wider than the screen; tab rows now wrap. The feed's
   tabs share the style; the feed journey still passes.
2. The address hint was inside the field label (so screen readers read it as the name) and showed a domain that
   doesn't exist; it's now a separate described hint showing the path only.
3. Creating a sixth community hit the generic rate limit before the clear "up to 5" message; the order is fixed.

## Test counts

| Suite | Before Phase 8 | After |
|---|---|---|
| Backend pytest | 551 | **573 passed** (`test_communities.py` 10) |
| Web vitest | 273 | **278 passed** (43 files; `communities.test.tsx` 5) |
| TypeScript / ESLint | pass / 0 | **pass / 0 errors** |
| Browser `e2e-p8-communities.mjs` (new) | — | **15/15** |
| Browser `e2e-p7-social.mjs` (regression) | 14 | **14/14** |

## Before enabling for real people

- **KI-36:** the under-18 decision covers communities too.
- **KI-40:** add an appeal path for community bans, and a site admin overview of communities.
- **KI-37/41:** name moderators; add a keyword pre-screen for posts and community names.
