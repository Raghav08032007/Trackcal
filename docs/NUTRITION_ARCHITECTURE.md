# Nutrition architecture

28 October 2026. `/nutrition` adds an account-saved diary while retaining the device journal in the original workspace.

## Sources and calculations

Canonical foods/nutrients/translations remain the existing catalog. Added aliases support regional spellings. Search uses indexed prefix/alias lookup and a bounded substring fallback when necessary; results and history are paginated/bounded. USDA/OFF lookup is an explicit existing public-source action. Regional-name hints are names only, not a fabricated food-composition dataset.

A reviewed item has name, gram quantity, optional per-100g energy/protein/carbs/fat, catalog ID or explicit manual override, source and estimation flag. Catalog IDs resolve nutrient values on the server; a caller cannot smuggle replacement nutrition while claiming the original catalog record. Renaming a catalog selection clears its ID/values for explicit review. Portion amount = per-100g amount × grams / 100. Missing values remain null, including when reading older diary records; totals are never silently filled with zero. Corrections do not claim clinical/analytical verification.

Meal logs/items and saved_meals are reused. The client supplies a stable UUID for retry-safe creation. Ownership is enforced before every update/delete/read; edits/deletes never re-award participation. Completed histories remain private and exportable. Deleting a diary entry is a soft delete and does not revoke earned participation XP. A dated backfill is allowed without new-day rewards; future entries are rejected. Day boundaries use the user's personalization timezone, with separate reward-day rules inherited from the fixed journey timezone.

## Daily interface and reuse

Meal groups include breakfast/lunch/dinner/snack/drink/other, with a source-aware nutrient summary, helpful empty states and manual correction before confirmation. Recent foods, favorites and saved multi-food combinations reduce repeated entry. New snapshots keep quantity and source data. Unsupported legacy saved snapshots remain preserved and labeled for review rather than being guessed/migrated silently. Diary and search pages expose paging; recent/favorite/saved previews are bounded.

Phase 2 diet/allergy/cuisine/preparation/ingredient rules feed suggestions. Unknown allergies/professional instructions suppress automated ideas. Saved/favorite foods remain user choices requiring ingredient review. Scanner photos cannot certify allergens. No restrictive intake plan is created; source confidence is not presented as a calibrated accuracy percentage.

## Rewards and privacy

A confirmed current-day diary entry uses the same central meal reward and weekly-consistency mechanism as Play. Saved-meal first-time participation uses a lifetime key. Favorite toggling, correction, deletion and repeated creation/retry do not create an endless reward loop. No XP depends on calories consumed/restricted or body changes.

Cloud and device records are labeled separately. Account export includes new food favorites/search history alongside existing diary/saved data. No automatic sharing or private device import. Local photo references use object URLs that are revoked on removal/unmount. See FOOD_SCANNER_SPEC.md and LIMITATIONS_REGISTER.md for source, image-retention and scale limits.
