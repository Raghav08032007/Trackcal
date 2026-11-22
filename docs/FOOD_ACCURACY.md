# Food accuracy

How the food catalogue was measured, what was wrong, and how the fixes were checked.

## What is measured

`backend/tests/test_food_accuracy.py` has 34 everyday foods, from rice and roti to sugar. Each was checked on what the search returns first when someone types the food's everyday name:

- **Right food:** the top result is the food people mean. For example, cooked rice for "rice", not raw grain.
- **Right calories:** its value per 100 g sits within the published range for that food (IFCT 2017 / USDA FoodData Central). The range is widened for regional and home-recipe variation.
- **Right portion:** the first portion offered is a realistic serving, for example 1 roti ≈ 40 g or 1 teaspoon of sugar ≈ 4 g.

It runs wherever the IFCT catalogue is loaded. To see the score per food group, run:

```
pytest tests/test_food_accuracy.py -s
```

## Results (test catalogue: IFCT 2017 + TrackCal standard recipes)

**Overall: 74/100 before (25 of 34 correct), 100/100 after (34 of 34).** Before the fixes, these searches went wrong:

| Typed | Top result before | Error |
|---|---|---|
| rice | Rice, raw, milled (356 kcal) | about 3× the calories of cooked rice (119) |
| rajma | Rajmah, red, dry (299) | about 3× the cooked curry (106) |
| egg / boiled egg | Quail egg | wrong food |
| roti | Bajra roti | wrong grain; "(no oil)" counted as an oil product |
| curd | Curd rice | plain curd missing |
| sugar | Custard apple | sugar missing |
| peanuts | nothing | IFCT calls it "Ground nut" |
| mango | Mango, green, raw | unripe fruit |

After the fixes, every group scores 100/100: grains, dishes, protein, dairy, fruit, vegetables and sweet.

## Fixes

- **Search ranking** (`services/food_rank.py`):
  - Rice, dal, rajma, oats, pasta and other grains and pulses mean the cooked food unless "raw" is typed.
  - Ripe fruit comes before unripe fruit, and the whole food before part of it (egg white, yolk).
  - IFCT's spelling "quial" ranks as a variant, like "quail".
  - Words after "no" or "without" no longer count against a food.
- **New standard foods** (`data/standard_recipes.py`):
  - Curd (dahi, plain), from IFCT whole cow milk, which has the same composition.
  - Sugar (white), from the USDA "Sugars, granulated" value already used by the recipes.
  - A "rajma" alias on the cooked rajma curry.
- **Search synonyms** (migration `0031`): peanut and groundnut → ground nut, and kaju, badam, akhrot and kishmish → their catalogue names.

## Limits

- This measures the catalogue and search, which is what a typed or spoken meal and a scanned barcode rely on. AI photo estimates are measured from real use instead (`services/accuracy.py`: estimate vs what the person kept, target ±20 %).
- Bread, oats, pasta and tofu are not in IFCT. They come from the full USDA import (`scripts/import_usda.py`), which production loads.
- To apply these changes to a database:
  1. Run `alembic upgrade head`.
  2. Run `python scripts/seed_standard_recipes.py`.
