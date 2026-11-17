import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMeal } from "../src/lib/meal-analysis.ts";

const food = { name: "Egg", quantity_g: 50, calories: 78, protein_g: 6.3, carbs_g: 0.6, fat_g: 5.3, confidence: 0.8 };
test("totals are recomputed from components rather than trusting model totals", () => {
  const meal = normalizeMeal({ components: [food, food], total_nutrition: { calories: 9000 } }, "test");
  assert.deepEqual(meal.total_nutrition, { calories: 156, protein_g: 12.6, carbs_g: 1.2, fat_g: 10.6 });
  assert.equal(meal.is_mock, false);
});
test("empty or incomplete inference never becomes invented nutrition", () => {
  for (const result of [null, {}, [], { components: [] }, [{ name: "Unknown" }]]) {
    assert.throws(() => normalizeMeal(result, "test"));
  }
});
test("negative, nonfinite and implausible nutrients are rejected", () => {
  for (const calories of [-1, NaN, Infinity, "78", 999999]) assert.throws(() => normalizeMeal([{ ...food, calories }], "test"));
});
test("array output and zero calorie items remain valid", () => {
  const meal = normalizeMeal([{ ...food, name: "Water", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }], "test");
  assert.equal(meal.total_nutrition.calories, 0);
  assert.equal(meal.dish_name, "Water");
});

test("portion range: the model's valid range, else a band that widens as confidence falls (same as the server)", () => {
  const model = normalizeMeal([{ ...food, quantity_g_low: 40, quantity_g_high: 70 }], "test").components[0];
  assert.deepEqual([model.portion_range_g, model.range_basis], [[40, 70], "model"]);
  const unsure = normalizeMeal([{ ...food, confidence: 0, quantity_g_low: 90, quantity_g_high: 20 }], "test").components[0];
  assert.deepEqual([unsure.portion_range_g, unsure.range_basis], [[25, 75], "confidence"]);
});
