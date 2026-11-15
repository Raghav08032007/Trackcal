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

Wave 1, done: navigation, section pages (Food, Move, Me), quick add, footer, appearance, sync status, feedback, the language picker
(186 texts in each language). Next, in order: sign-in and sign-up, Today, food logging, Move and the camera (including spoken cues),
Play, Me and settings, then every other screen, then server messages, emails and notifications.
