/** Corrections to a scanned plate. `ratio` is the portion slider, kept so a dish doesn't jump when another is changed. */
export type PlateItem = { name: string; portion: string; cal: number; p: number; c: number; f: number; count?: number | null; edible?: number | null };
export type PlateFood = { name: string; serving_size: string; calories: number; protein: number; carbs: number; fat: number };

const settled = <T extends PlateItem>(item: T, ratio: number): T => ({ ...item, portion: `${Math.round(parseFloat(item.portion) * ratio)}g`, cal: item.cal * ratio, p: item.p * ratio, c: item.c * ratio, f: item.f * ratio, edible: item.edible ? item.edible * ratio : item.edible });

export const dropDish = <T extends PlateItem>(items: T[], index: number, ratio: number) => items.filter((_, i) => i !== index).map(item => settled(item, ratio));
export const addDish = <T extends PlateItem>(items: T[], dish: T, ratio: number) => [...items.map(item => settled(item, ratio)), dish];
/** Catalog values are per serving_size, usually 100 g. */
export function foodDish(food: PlateFood, grams: number): PlateItem {
  const share = grams / (parseFloat(food.serving_size) || 100);
  return { name: food.name, portion: `${Math.round(grams)}g`, cal: food.calories * share, p: food.protein * share, c: food.carbs * share, f: food.fat * share };
}
export function plateTotals(items: PlateItem[]) {
  const sum = (pick: (item: PlateItem) => number) => items.reduce((total, item) => total + pick(item), 0);
  return { weight: `${Math.round(sum(item => parseFloat(item.portion)))}g`, calories: sum(item => item.cal), protein: sum(item => item.p), carbs: sum(item => item.c), fat: sum(item => item.f) };
}
