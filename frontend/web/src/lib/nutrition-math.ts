import { t } from "@/lib/i18n";
// Pure nutrition arithmetic (mirrors backend/services/nutrition_math.py so the app and the server agree).
// Values are per 100 g unless stated. Unknown is null and stays null, never 0. Calories round to a whole number,
// macros to one decimal, halves rounding up. Totals over items with unknown values are reported as partial.

export const FIELDS = ["energy_kcal", "protein_g", "carbs_g", "fat_g"] as const;
export type Field = (typeof FIELDS)[number];
export type Nutrients = Record<Field, number | null>;

const ATWATER: Record<Exclude<Field, "energy_kcal">, number> = { protein_g: 4, carbs_g: 4, fat_g: 9 };
export const SERVING_UNITS_G = { g: 1, katori: 150, cup: 240, tablespoon: 15, teaspoon: 5 } as const;

const finiteNonNegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function roundValue(field: Field, value: number | null): number | null {
  if (value === null) return null;
  return field === "energy_kcal" ? Math.floor(value + 0.5) : Math.floor(value * 10 + 0.5) / 10;
}

export function scale(per100g: Nutrients, grams: number): Nutrients {
  if (!finiteNonNegative(grams)) throw new Error(t("Grams must be a finite, non-negative number."));
  const result = {} as Nutrients;
  for (const field of FIELDS) {
    const value = per100g[field];
    if (value !== null && !finiteNonNegative(value)) throw new Error(t("{field} must be a finite, non-negative number or unknown.", { field }));
    result[field] = value === null ? null : (value * grams) / 100;
  }
  return result;
}

export function rounded(values: Nutrients): Nutrients {
  const result = {} as Nutrients;
  for (const field of FIELDS) result[field] = roundValue(field, values[field]);
  return result;
}

export function total(items: Nutrients[]): { totals: Nutrients; partial: Field[] } {
  const totals = {} as Nutrients, partial: Field[] = [];
  for (const field of FIELDS) {
    const known = items.map(item => item[field]).filter((value): value is number => value !== null);
    totals[field] = known.length ? known.reduce((sum, value) => sum + value, 0) : null;
    if (known.length && known.length < items.length) partial.push(field);
  }
  return { totals, partial };
}

export function servingGrams(unit: keyof typeof SERVING_UNITS_G | "piece", quantity = 1, gramsPerPiece: number | null = null): number | null {
  if (!finiteNonNegative(quantity)) throw new Error(t("Quantity must be a finite, non-negative number."));
  if (unit === "piece") return gramsPerPiece === null ? null : quantity * gramsPerPiece; // never guessed
  return quantity * SERVING_UNITS_G[unit];
}

/** True when calories differ from 4·protein + 4·carbs + 9·fat by more than 20% ("please double-check"). */
export function consistencyWarning(values: Nutrients): boolean {
  if (FIELDS.some(field => values[field] === null)) return false;
  const expected = (values.protein_g as number) * ATWATER.protein_g + (values.carbs_g as number) * ATWATER.carbs_g + (values.fat_g as number) * ATWATER.fat_g;
  const stated = values.energy_kcal as number;
  if (Math.max(expected, stated) < 20) return false;
  return Math.abs(stated - expected) > 0.2 * Math.max(expected, stated);
}
