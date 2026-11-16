import { t, msg } from "@/lib/i18n";
export type Nutrients = { calories: number; protein: number; carbs: number; fat: number };
export type DraftIngredient = { id: string; name: string; grams: number | null; calories: number | null; protein: number | null; carbs: number | null; fat: number | null; original: string; source: string };
export type SavedRecipe = { id: string; name: string; servings: number; cost: number; currency: string; minutes: number; tags: string[]; ingredients: DraftIngredient[]; instructions: string; totals: Nutrients };
export type PantryEntry = { id: string; name: string; grams: number; expires: string };
export type ShoppingEntry = { name: string; needed_g: number; available_g: number; buy_g: number; checked: boolean };
export type WorkoutEntry = { id: string; date: string; name: string; minutes: number; sets: number; reps: number; load: number; source: string };
export function matchesDiet(tags: string[], diet: string) {
  const reviewed = tags.map(tag => tag.trim().toLowerCase());
  if (diet === "balanced") return true;
  if (diet === "vegan") return reviewed.includes("vegan");
  if (diet === "vegetarian") return reviewed.some(tag => tag === "vegetarian" || tag === "vegan");
  if (diet === "pescatarian") return reviewed.some(tag => ["pescatarian", "vegetarian", "vegan"].includes(tag));
  return false;
}
export const nutrientKeys = ["calories", "protein", "carbs", "fat"] as const;
export function recipeTotals(ingredients: DraftIngredient[], servings: number): Nutrients {
  if (!Number.isInteger(servings) || servings < 1 || servings > 100 || !ingredients.length) throw new Error(t("Add ingredients and set 1–100 servings."));
  const totals: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const item of ingredients) {
    if (!item.name.trim() || item.grams === null || !Number.isFinite(item.grams) || item.grams <= 0 || item.grams > 20000) throw new Error(t("Confirm a name and gram weight for every ingredient."));
    for (const key of nutrientKeys) { const value = item[key]; if (value === null || !Number.isFinite(value) || value < 0 || value > 20000) throw new Error(t("Confirm all four nutrition values per 100g for every ingredient. Unknown values stay blank.")); totals[key] += value * item.grams / 100 / servings; }
  }
  if (Object.values(totals).some(value => value > 20000)) throw new Error(t("Per-serving nutrition exceeds the supported journal limits. Check quantities and servings."));
  return Object.fromEntries(nutrientKeys.map(key => [key, Math.round(totals[key] * 100) / 100])) as Nutrients;
}
export function planCandidate(recipe: SavedRecipe) { return { id: recipe.id, name: recipe.name, ...recipe.totals, cost: recipe.cost / recipe.servings, minutes: recipe.minutes, tags: recipe.tags }; }
export function shoppingIngredients(recipes: SavedRecipe[]) { return recipes.flatMap(recipe => recipe.ingredients.map(ingredient => ({ name: ingredient.name, grams: ingredient.grams! / recipe.servings }))); }
export function expiryState(expires: string, today: string) { if (!expires) return t("No expiry supplied"); if (expires < today) return t("Expired — excluded from shopping calculations"); const days = Math.round((new Date(expires + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86400000); return days <= 3 ? msg("Use soon") : msg("In date"); }
export function compareFoodCost(price: number, packGrams: number, servingGrams: number, proteinPer100: number) {
  if (![price, packGrams, servingGrams, proteinPer100].every(Number.isFinite) || price < 0 || packGrams <= 0 || servingGrams <= 0 || proteinPer100 < 0 || proteinPer100 > 100) throw new Error(t("Enter a nonnegative price, positive weights and protein between 0 and 100g per 100g."));
  const per100 = price / packGrams * 100;
  return { per100, perServing: per100 * servingGrams / 100, per20gProtein: proteinPer100 > 0 ? per100 * 20 / proteinPer100 : null };
}
export async function toolRequest<T>(action: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/tools/${action}`, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || t("The request failed.")); return data;
}
export function readFileData(file: File, kind: "image" | "audio"): Promise<string> {
  if (!file.size || file.size > (kind === "image" ? 8 : 10) * 1000000) throw new Error(kind === "image" ? t("Choose a nonempty image file under 8 MB.") : t("Choose a nonempty {kind} file under 10 MB.", { kind }));
  if (kind === "image" && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error(t("Use JPEG, PNG or WebP."));
  if (kind === "audio" && !/\.wav$/i.test(file.name)) throw new Error(t("Use a WAV audio file."));
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error(t("File could not be read."))); reader.readAsDataURL(file); });
}
