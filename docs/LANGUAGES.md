# Languages

TrackCal speaks English plus nine wave-1 languages. Each is a **draft** until a native speaker reviews it; the language picker says
so in the language itself.

## Why these languages

| Wave | Indian | International | Reason |
|---|---|---|---|
| 1 (now) | Hindi, Bengali, Marathi, Telugu, Tamil | Spanish, Portuguese (Brazil), Indonesian, Arabic | India is the largest market for health and fitness app downloads, then Brazil, the US, Mexico and Germany (Statista, Google Play, June 2024); Indonesia is a top-5 app market overall (AppTweak 2025). Most Indian internet users prefer Indian languages (Kantar/Google 2023: 729 million Indian-language users; Storyboard18 2024: 57% of urban users); Google-KPMG put Hindi at about 38% of them, then Marathi 9%, Bengali 8%, Tamil and Telugu 6% each. Arabic covers the Gulf, including its large Indian community. |
| 2 | Gujarati, Kannada, Malayalam, Urdu, Punjabi, Odia | French, German, Turkish, Vietnamese, Japanese, Russian | Germany is a top-5 fitness market; Urdu is right to left like Arabic. |
| 3 | Assamese and requests | Chinese (Simplified), Korean, Italian, Thai, Filipino | By sign-ups. |

The server already accepts every wave-1 and wave-2 code (`ui_language` for the interface; `language` stays the language for food names).

## How it works

- `t("English text")` shows a text in the chosen language; the English is the key, so anything untranslated shows in English.
  Placeholders: `t("{count} meals", { count })`. Plural forms (`one`, `few`, `other`...) follow each language's own rules.
- Texts kept in lists are marked `msg("...")` where they are defined and shown with `t(label)`.
- Numbers and dates use the language's style: 1,00,000 in Indian languages, 100.000 in Brazil.
- Arabic switches the whole page to right to left; the brand name stays left to right.
- Only the chosen language's text is downloaded. Changing language redraws the app once.
- The choice is kept on the device and, when signed in, on the account (a new device signed in to the account starts in it).

## Translating a screen

1. Wrap its texts in `t()` (or `msg()` in lists).
2. Add the English texts and their translations to a table in `frontend/web/scripts/i18n/` (one row per text, one column per language).
3. Run `backend/.venv/Scripts/python frontend/web/scripts/i18n/build.py` to rebuild `src/lib/i18n/messages/*.json`.
4. Add the file to `TRANSLATED_FILES` in `src/lib/i18n/coverage.ts`. `tests/i18n.test.ts` then fails if any of its texts is
   missing in any wave-1 language, or if a translation drops or invents a `{placeholder}`.

## Review by native speakers

Reviewers edit the tables in `scripts/i18n/`, then set `reviewed: true` for their language in `src/lib/i18n/locales.ts`.
Check first, in this order: safety warnings (camera exercises, injuries), the Health Score and report advice, payment and trial terms,
privacy texts. Keep the glossary consistent.

### Glossary (keep these the same everywhere)

| English | Notes |
|---|---|
| TrackCal, Pip, Premium, GPS, XP | Product names: not translated (written in the local script where natural, e.g. प्रीमियम). |
| kcal | Keep the unit; Indonesian kkal, Arabic سعرة. |
| MET, MET-minutes | Keep "MET"; explain once per screen if needed. |
| rep / reps | The common gym word in each language (Hindi रेप्स, Tamil மறுமுறைகள்). |
| segment | A timed stretch of road or path. |
| streak | Days in a row. |
| Health Score | One consistent term per language; it is guidance, never a diagnosis. |

## Progress

Wave 1, done (4,505 web texts and 1,005 server texts in each language):
- the app frame: navigation, section pages, quick add, footer, appearance, sync status, feedback, the language picker;
- sign-in, sign-up and account recovery;
- Today: plan, tasks, Health Score, coach lines, recovery check-in, your day, daily progress and companions;
- food logging: diary, photo scanner, barcode, describe a meal, food search, on-device journal, recipes, menu picker, meal planner,
  smart tools, targets, fasting;
- Move: camera workouts with every exercise, level, tip and camera message, the spoken voice coach (it speaks in the chosen
  language with a matching installed voice), holds, choosing by muscle, workout builder and programs, GPS recording, routes,
  activities and privacy zones, segments, weekly effort, recovery map, workout history, safety checks, rep replay and the
  companion card;
- Play: quests and Pip's garden, Label Detective, the camera sports games (skip rope, shadow boxing, cricket drive,
  badminton smash) with their coaching lines, the six companions, bond card, challenges, feed and posts, communities,
  events and event check-in. Feed times ("5 min ago") use the browser's own wording for each language;
- Me and settings: the 8-step onboarding (goals, body, region, food, injuries with the body map, week), account and
  security, health report and its plan, progress and training load, premium and payments, notifications and reminders,
  coach booking, history export and import, help, the guided test drive, and the journey companion shown on every page.
  State and country names stay as typed because they are saved as entered;
- every other screen: the design system page, search and the command palette, voice input, label reading, the exercise
  library, pantry and Grocy, price checks, photo credits, the body preview, the app tour, the privacy notice, the product
  terms, "page not found", and every browser tab title (the tab title changes with the language too);
- the standalone offline journal (`public/offline.html`), which opens with no network and no app bundle. `build.py` writes
  its texts to `public/offline-i18n.js` (the rows listed in `OFFLINE_KEYS` in `scripts/i18n/offline.py`), and the service
  worker caches that file with the page.

Left in English on purpose: food and product names from databases, photo file names and artists' names on the credits page,
the user's own email and entries, CSV column names, keyboard shortcuts, and saved source labels such as "Manual entry".
The privacy notice and terms also need a legal review in each language before launch.

## Wave 2 (in phases)

Owner's choice (20 Nov 2026): Kannada, Malayalam, Gujarati, Punjabi, Urdu, French, German, then the highest-demand
international languages. Each language is added screen by screen; anything not yet translated shows in English, which
the app already does safely. The picker marks every wave-2 language as a draft.

| Phase | Kannada (kn) | Malayalam (ml) | Gujarati (gu) | Punjabi (pa) | Urdu (ur), right to left |
|---|---|---|---|---|---|
| 1. Navigation, sign-in, Today (tasks, Health Score, check-ins, targets, coach lines), quick add, search, offline journal | Done | Done | Done | Done | Done |
| 2. Onboarding, food diary and search, Food hub, meal ideas | Done | Done | Done | Done | Next |
| 3. Move (workouts, camera, exercise names), Play, Me | Next | Next | Next | Next | Later |
| Server messages | Today's texts and meal ideas | Same | Same | Same | Same |

- How it is checked: `CORE_PHASES` in `src/lib/i18n/coverage.ts` groups the core screens by phase and `WAVE_2` records
  each language's phase; a language must cover every screen up to its phase completely; `tests/i18n.test.ts` fails if any text on them is missing or loses a `{placeholder}`. Each phase adds
  screens to that list. Server texts not yet translated are sent in English (the server test checks wave 1 only).
- Still English on Today in phase 1: exercise names (they come with the Move phase).
- Tables: `frontend/web/scripts/i18n/wave2_*.py` and `backend/i18n/tables/wave2_*.py`, one column per wave-2 language.
- Fixed while doing this: the sleep-quality buttons (Restless / Okay / Rested) were shown untranslated in every
  language; they are now translated in all 11.
- Fixed 21 Nov 2026, for every language: the nutrient names on Today's targets (Protein, Carbs, Fat) and the streak
  badge's unit (day/days) were built from code words instead of translated. The coverage extractor now also reads
  single-quoted t('...') texts, which it skipped before (5 texts; wave 1 already had them).

## Server messages (step 8, done)

The server answers in the person's language too: 1,005 texts in each wave-1 language.
- **How:** the web app sends the chosen language with every `/api` request (`sendLanguageToServer()` in
  `src/lib/i18n/index.ts`). The server's `tr()` (`backend/services/i18n.py`) reads it; error messages are translated in one
  place (`flask_app/errors.py`, and `error()` in `flask_app/web_gateway.py`, which also forwards the language).
- **What:** Today's tasks, the Health Score, the streak rule, daily targets, training notes, the 40 motivation lines, plan
  templates (114) and explanations, meal ideas, lessons, the blood report (test names, explanations, diet and activity
  advice), recovery stages, the exercise catalogue, about 380 error messages, the account emails, the Monday summary email
  and push notifications.
- **Emails and notifications** sent by the scheduler use the language saved on the account (`for_preferences()`: the app's
  interface language, else the food-name language when TrackCal speaks it, else English).
- **Tables:** `backend/i18n/tables/*.py` (same format as the web app's), built with `backend/i18n/build.py`.
  `backend/tests/test_i18n.py` fails if any wrapped text, error message or data-table text is missing in a language, or if
  a translation drops a `{placeholder}`. Exercise names and some sentences are copied from the web app's catalogs
  (`gen_exercise_names.py`, `*_shared.py`) so they read the same everywhere.
- **Numbers** in server texts are written the way the browser writes them (1,50,000 in Hindi, Bengali digits in Bengali,
  1.500 in Brazil).
- **Kept in English:** names of guidelines and studies (WHO, ADA, KDIGO, Compendium of Physical Activities), stored
  workout names in history, and plans saved before step 8 when a sentence held numbers.
- The health texts need a clinical review in each language, as well as a native one.

Counted texts: each language's catalog holds its own plural forms; English singulars live in `src/lib/i18n/en-plurals.ts`.
A test fails if a text with plural forms is shown without a `count`.
