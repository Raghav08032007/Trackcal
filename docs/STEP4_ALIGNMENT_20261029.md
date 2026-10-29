# Step 4 (part 1): navigation, alignment and live feature checks — 29 October 2026

## Owner decision: navigation

On 29 October 2026 the owner chose a **bottom tab bar** (Home, Food, Move, Play, Me). This replaces the earlier "no navigation bar" direction recorded in `UX_HOME_REORGANIZATION_20261028.md`.

- **Phones:** a fixed bottom bar with 44 px+ targets, safe-area padding, and the current tab marked (`aria-current="page"`).
- **From 860 px:** the same five tabs as a sticky top bar.
- **Slim page header:** brand link, "Ask Pip", and the current section's pages as a scrollable row. Food has 7 pages, Move 3, Play 2, Me 8, so every destination is within two taps.
- **Sign-in screens and the offline journal** have no navigation. Home keeps its own header.
- **The footer** went from 13 links to Appearance, Reduce motion, Guided test drive, Help, Privacy and Terms.
- **Bottom-docked elements** (toasts, the floating companion and its re-enable button, the onboarding companion) are lifted above the tab bar.

Code: `src/components/app-navigation.tsx`, `src/app/navigation.css`. The old `studio-navigation.tsx` was removed.

## Alignment fixes

| Problem | Fix |
|---|---|
| Nutrition, Workouts, Camera and Play each had their own header and link row duplicating navigation | Removed; Play keeps its Calm mode control |
| The food workspace's internal switcher was labelled "Main navigation" | Renamed "Food workspace sections" |
| Home header buttons wrapped to a second row; "Pause motion" took a full row on phones | One-row header; compact 44 px buttons (`src/app/layout.css`) |
| Signed-out cards ran "Sign in →" and the alternative together as plain text (4 pages) | A primary "Sign in" button and a secondary button, full width on phones |
| `/routine` scrolled sideways at 360 px | See the frontend migration report |

## Live feature checks (real services)

| Feature | Result |
|---|---|
| Barcode lookup (Open Food Facts) | **PASS**: 3017620422003 → Nutella, 539 kcal/100 g |
| Food search (USDA FoodData Central) | **PASS**: "banana" → 12 complete results |
| AI meal estimate (OpenRouter) | **FAILED, then FIXED.** `OPENROUTER_MODEL=openrouter/free` lets OpenRouter pick any free model; it picked a content-safety classifier that replied "User Safety: safe", so every estimate failed (correctly, without inventing food). Now the API sends two named free vision models in fallback order (`google/gemma-4-31b-it:free`, `nvidia/nemotron-3.5-super-vl:free`); `OPENROUTER_MODEL` accepts one model or a comma-separated list. Rerun: "2 idli with coconut chutney and a cup of sambar" → 3 items, 315 kcal, in 20.8 s via the fallback model |

Not verified: a real meal **photo** through the live model (the stubbed tests cover the photo path); estimate accuracy (Phase 2); and latency. About 20 s is slow, and the scanner already shows progress while it waits.

## Verification

358/358 backend, 168/168 web, TypeScript, lint 0 errors / 2 accepted warnings. In Chromium: studio 14/14 (now expecting exactly one main navigation), all 27 routes and the 404 page clean at 360 px, and privacy 16/16.

## Remaining in step 4

End-to-end UI journeys for every feature while signed in: diary add/edit/delete, saved meals, workouts and camera save, plan and onboarding, quests and XP, reminders, coach booking, smart tools, export, password change and account closure. Each runs at 360 px and desktop, including failure paths.
