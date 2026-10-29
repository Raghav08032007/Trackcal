# Data sources

Every nutrition value TrackCal shows comes from one of the sources below, and the source is shown next to the value.
A value the source doesn't give is stored as unknown (no row, shown as blank or "Unknown"), never as 0.

| Source | Used for | Licence / terms | Attribution shown | Stored in repo? |
|---|---|---|---|---|
| IFCT 2017, ICMR–National Institute of Nutrition, Hyderabad | Catalog of 542 Indian foods, with local names in 19 languages (including English) | Data © ICMR-NIN. Packaging (`@ifct2017/compositions` 2.0.9) is MIT | "IFCT 2017, National Institute of Nutrition, Hyderabad" on every result | **No.** Downloaded by `backend/scripts/seed_ifct.py` into `backend/runtime/ifct/` (git-ignored) |
| Open Food Facts | Barcode lookups | Database: ODbL 1.0; images: CC BY-SA | "Data from Open Food Facts contributors (ODbL)." on every barcode result | No. Responses are cached in `barcode_cache` (30 days found, 24 h not found) |
| USDA FoodData Central | "Search public sources" (live API) | Public domain (CC0) | "USDA FoodData Central" on every result | No |
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

## Open Food Facts

- Requests send a `User-Agent` built from `OPEN_FOOD_FACTS_APP_NAME`, `OPEN_FOOD_FACTS_APP_VERSION` and
  `OPEN_FOOD_FACTS_CONTACT`. **Owner to do:** update these in `backend/.env` (they still say GlobalFoodAI).
- The data is community-entered, so the UI says so. Missing values become label inputs, and a product can't be logged
  until every value is filled in. A product can be saved to "my foods" (a favourite) with the user's corrections. This
  saves a private copy and never writes back to Open Food Facts.

## Search vocabulary

- Spelling variants (idly→idli, dosai→dosa, thayir→curd, …) are in the `search_synonyms` table (migration 0004). We
  wrote this list ourselves; it isn't copied from any source.
