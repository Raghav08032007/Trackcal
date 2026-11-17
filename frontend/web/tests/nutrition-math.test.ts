import { describe, expect, it } from "vitest";
import { consistencyWarning, FIELDS, roundValue, rounded, scale, servingGrams, total, type Nutrients } from "@/lib/nutrition-math";

const EGG: Nutrients = { energy_kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11 };
// Small seeded generator so property tests are reproducible.
function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

describe("nutrition maths (same rules as the server)", () => {
  it("scales per 100 g and rounds like the server", () => {
    expect(rounded(scale(EGG, 50))).toEqual({ energy_kcal: 78, protein_g: 6.5, carbs_g: 0.6, fat_g: 5.5 });
  });
  it("keeps unknown values unknown", () => {
    expect(scale({ ...EGG, fat_g: null }, 200).fat_g).toBeNull();
  });
  it.each([-1, NaN, Infinity])("rejects invalid grams %s", grams => { expect(() => scale(EGG, grams)).toThrow(); });
  it("rounds whole kcal and one-decimal macros, halves up", () => {
    expect(roundValue("energy_kcal", 77.5)).toBe(78); expect(roundValue("energy_kcal", 77.49)).toBe(77);
    expect(roundValue("protein_g", 0.25)).toBe(0.3); expect(roundValue("carbs_g", null)).toBeNull();
  });
  it("scaling is linear (property)", () => {
    const random = rng(11);
    for (let i = 0; i < 500; i++) {
      const food = Object.fromEntries(FIELDS.map(f => [f, random() * 900])) as Nutrients, a = random() * 1000, b = random() * 1000;
      const together = scale(food, a + b), one = scale(food, a), two = scale(food, b);
      for (const f of FIELDS) expect(together[f]).toBeCloseTo((one[f] as number) + (two[f] as number), 6);
    }
  });
  it("totals are order-independent and report partial fields (property)", () => {
    const random = rng(5);
    for (let i = 0; i < 300; i++) {
      const items = Array.from({ length: 1 + Math.floor(random() * 8) }, () => Object.fromEntries(FIELDS.map(f => [f, random() < 0.3 ? null : random() * 500])) as Nutrients);
      const shuffled = [...items].sort(() => random() - 0.5);
      expect(rounded(total(items).totals)).toEqual(rounded(total(shuffled).totals));
      expect(total(items).partial).toEqual(total(shuffled).partial);
    }
    expect(total([{ energy_kcal: 100, protein_g: 5, carbs_g: null, fat_g: null }, { energy_kcal: 50, protein_g: null, carbs_g: null, fat_g: null }]))
      .toEqual({ totals: { energy_kcal: 150, protein_g: 5, carbs_g: null, fat_g: null }, partial: ["protein_g"] });
  });
  it("converts household servings and never guesses a piece weight", () => {
    expect(servingGrams("katori", 2)).toBe(300); expect(servingGrams("piece", 3, 40)).toBe(120); expect(servingGrams("piece", 3)).toBeNull();
  });
  it("flags values that do not add up", () => {
    expect(consistencyWarning(EGG)).toBe(false);
    expect(consistencyWarning({ energy_kcal: 100, protein_g: 10, carbs_g: 50, fat_g: 20 })).toBe(true);
    expect(consistencyWarning({ ...EGG, fat_g: null })).toBe(false);
  });
});
