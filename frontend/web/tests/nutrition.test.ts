import { describe, it, expect } from "vitest";
import { calculatePlan, scaleNutrition } from "../src/lib/nutrition";
import { validStoredValue } from "../src/lib/storage-validation";
const params = { age: 28, gender: "male" as const, weight_kg: 75, height_cm: 180, activity_level: "moderately_active" as const, primary_goal: "lose_weight" as const };
describe("goals and portion arithmetic", () => {
  it("calculates loss, maintenance and muscle gain consistently with the UI", () => {
    expect(calculatePlan(params)).toMatchObject({ bmr: 1740, tdee: 2697, calorie_target: 2197 });
    expect(calculatePlan({ ...params, primary_goal: "maintain" }).calorie_target).toBe(2697);
    expect(calculatePlan({ ...params, primary_goal: "gain_muscle" }).calorie_target).toBe(2997);
  });
  it.each([{ age: -1 }, { age: 17 }, { weight_kg: 0 }, { height_cm: NaN }, { weight_kg: Infinity }])("rejects invalid goal input %j", bad => { expect(() => calculatePlan({ ...params, ...bad })).toThrow(); });
  it("macro energy matches the target within gram rounding", () => { const plan = calculatePlan(params); expect(Math.abs(plan.macros.protein_kcal + plan.macros.carbs_kcal + plan.macros.fat_kcal - plan.calorie_target)).toBeLessThanOrEqual(2); });
  it("scales calories and every macro by the same gram factor", () => { expect(scaleNutrition({ calories: 200, protein: 12, carbs: 20, fat: 8 }, .5)).toEqual({ calories: 100, protein: 6, carbs: 10, fat: 4 }); });
  it("rejects invalid portion multipliers", () => { expect(() => scaleNutrition({ calories: 200, protein: 12, carbs: 20, fat: 8 }, -1)).toThrow(); });
});
describe("saved data validation", () => {
  it.each([null, {}, [null], [{ name: "Missing values" }]])("rejects corrupted meal data %j", value => expect(validStoredValue("trackcal:journal:2026-10-20", value)).toBe(false));
  it("rejects zero servings and invalid targets", () => { expect(validStoredValue("trackcal:recipe:servings", 0)).toBe(false); expect(validStoredValue("trackcal:target:calories", -2)).toBe(false); });
});
