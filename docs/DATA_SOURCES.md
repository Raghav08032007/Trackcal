# Data sources

Every nutrition value TrackCal shows comes from one of the sources below, and the source is shown next to the value.
A value the source doesn't give is stored as unknown (no row, shown as blank or "Unknown"), never as 0.

| Source | Used for | Licence / terms | Attribution shown | Stored in repo? |
|---|---|---|---|---|
| IFCT 2017, ICMR–National Institute of Nutrition, Hyderabad | Catalog of 542 Indian foods, with local names in 19 languages (including English) | Data © ICMR-NIN. Packaging (`@ifct2017/compositions` 2.0.9) is MIT | "IFCT 2017, National Institute of Nutrition, Hyderabad" on every result | **No.** Downloaded by `backend/scripts/seed_ifct.py` into `backend/runtime/ifct/` (git-ignored) |
| Open Food Facts | Barcode lookups | Database: ODbL 1.0; images: CC BY-SA | "Data from Open Food Facts contributors (ODbL)." on every barcode result | No. Responses are cached in `barcode_cache` (30 days found, 24 h not found) |
| USDA FoodData Central | "Search public sources" (live API) | Public domain (CC0) | "USDA FoodData Central" on every result | No |
| TrackCal standard recipes | 90 everyday cooked Indian dishes (dal, roti, idli, biryani, chai...) | Our own recipe compositions; values calculated from the IFCT foods above, so IFCT's launch gate applies | "TrackCal recipe, calculated from IFCT 2017 ingredients" | Recipes yes (`backend/data/standard_recipes.py`); values no (calculated at seed time) |
| User entries | Foods people add or correct themselves | Belongs to the user | "Your entry" / "Barcode <code>" | User data only |

## IFCT 2017: launch gate

**IFCT data may be used in development and closed beta. Before public launch we need written permission from ICMR-NIN.**

- The book's values belong to ICMR-NIN. The MIT licence covers only the npm package's code and CSV layout, not the
  rights to the data itself. Owner decision (2026-10-29): seed now for development and beta, show attribution, and get
  written permission before launch.
- Launch checklist item: request permission from the Director, ICMR-NIN, Hyderabad (nin.res.in). Record the reply
  (date, reference number, any conditions) in this file. If permission is refused, run migration `0004` downgrade
  (or delete foods with `data_source = 'ifct'`). Meals people already logged keep their own name and nutrient copy.
- **Do not use the `ifct2017` package** (the main package). It is **AGPL-3.0**. We only install
  `@ifct2017/compositions` 2.0.9 (MIT). The seed script checks the tarball's published sha512 before reading it.
- Data notes:
  - Energy is converted from kJ (÷ 4.184).
  - IFCT lists 0 kJ for 14 oils and fats (oils, ghee, vanaspati). These get an Atwater estimate (4/4/9 kcal per g)
    marked `is_estimated`, with a note saying how it was calculated. The UI shows "includes estimates".
  - Owner to do before launch: spot-check 20 foods against the printed tables.
- Re-seed (idempotent; updates in place): `python scripts/seed_ifct.py`. It needs migration 0004 or later.

### IFCT energy check

- IFCT 2017 calculates energy as 17 kJ per g of protein and available carbohydrate, 37 kJ per g of fat and 8 kJ per g of
  fibre. 531 of the 542 foods match that within 15%. The seed script replaces a listed energy that is more than 50% and
  more than 100 kcal above what the food's own nutrients supply, and marks it as an estimate with the listed value in
  the note. Today that is one food: **chicken leg, skinless** (listed 383.6 kcal; 191 kcal from its protein and fat).
  Before this check, a logged chicken leg counted about twice its calories.
- Left as listed: spices, curry leaves and dried chillies (15-29% below the formula, which is how their fibre is
  counted; eaten in grams), lemon juice and crab (under 30 kcal apart).

## TrackCal standard recipes

- `backend/data/standard_recipes.py`: 90 dishes we wrote ourselves (rice dishes, breads, breakfast, dal, vegetables,
  non-vegetarian, snacks, sweets, drinks), each with raw IFCT ingredients in grams, the cooked weight, everyday
  portions (katori, roti, piece, glass) and local names and spellings for search.
- `python scripts/seed_standard_recipes.py` (after `seed_ifct.py`) calculates per 100 g cooked from the ingredients and
  saves them as IFCT-sourced foods with `external_id = recipe:<slug>`, so removing IFCT data removes them too.
- Every value is marked as calculated (`is_estimated`), the dishes are not marked verified, and search shows
  "TrackCal recipe, calculated from IFCT 2017 ingredients". Home recipes vary, often by 20-30% (mostly oil and ghee).
- Stand-ins, stated in the file: sugar from USDA FoodData Central (public domain); curd and buttermilk as whole cow
  milk; gram flour as Bengal gram dal. Salt and spices are not counted (under 1% of energy).
- `tests/test_standard_recipes.py` checks the arithmetic and that 20 everyday portions fall in commonly published
  calorie ranges. **Owner to do before launch:** a dietitian reviews the compositions.

## Indian Nutrient Databank (INDB): not used

- INDB (Vijayakumar et al., Curr Dev Nutr 2024) has 1,014 cooked recipes, but its GitHub repository has no licence and
  the paper gives no terms for the data. Without a licence it cannot be bundled in a paid app.
- **Owner to do:** ask the authors for permission (draft email in the 20 Nov 2026 session notes). Record the reply here.
  INDB's raw-food values come from IFCT, so IFCT's permission is needed as well.

## Open Food Facts

- Requests send a `User-Agent` built from `OPEN_FOOD_FACTS_APP_NAME`, `OPEN_FOOD_FACTS_APP_VERSION` and
  `OPEN_FOOD_FACTS_CONTACT`. **Owner to do:** update these in `backend/.env` (they still say GlobalFoodAI).
- The data is community-entered, so the UI says so. Missing values become label inputs, and a product can't be logged
  until every value is filled in. A product can be saved to "my foods" (a favourite) with the user's corrections. This
  saves a private copy and never writes back to Open Food Facts.

## Search vocabulary

- Spelling variants (idly→idli, dosai→dosa, thayir→curd, …) are in the `search_synonyms` table (migration 0004). We
  wrote this list ourselves; it isn't copied from any source.
