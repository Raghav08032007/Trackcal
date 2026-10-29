export interface MealComponent {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
  /** A photo can't measure weight: the model's low/high grams ("model"), or a band that widens as confidence falls ("confidence"). */
  portion_range_g: [number, number];
  range_basis: "model" | "confidence";
  calorie_range: [number, number];
}

export interface MealAnalysis {
  dish_name: string;
  components: MealComponent[];
  total_nutrition: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  model: string;
  is_mock: false;
  calorie_range: [number, number];
}

function portionRange(item: Record<string, unknown>, quantity: number, confidence: number): [[number, number], "model" | "confidence"] {
  const low = item.quantity_g_low, high = item.quantity_g_high;
  if (typeof low === "number" && typeof high === "number" && Number.isFinite(low) && Number.isFinite(high) && low > 0 && low <= quantity && quantity <= high && high <= 10000) {
    return [[round1(low), round1(high)], "model"];
  }
  const width = 0.15 + 0.35 * (1 - confidence);
  return [[round1(quantity * (1 - width)), round1(quantity * (1 + width))], "confidence"];
}
const round1 = (value: number) => Math.round(value * 10) / 10;

export function normalizeMeal(raw: unknown, model: string): MealAnalysis {
  const root = raw as Record<string, unknown>;
  const items = Array.isArray(raw) ? raw : root?.components ?? root?.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
    throw new Error("No readable food found. Try a clearer photo or describe the meal.");
  }
  const components: MealComponent[] = items.map((item) => {
    if (!item || typeof item.name !== "string" || !item.name.trim()) throw new Error("Invalid food response.");
    const number = (key: string, max: number) => {
      const value = item[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) {
        throw new Error("Incomplete nutrition response. Please retry or enter your meal manually.");
      }
      if (key === "quantity_g" && value <= 0) throw new Error("The portion estimate is missing. Retry or log manually.");
      return Math.round(value * 10) / 10;
    };
    const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : 0;
    const quantity = number("quantity_g", 10000), calories = number("calories", 20000);
    const [portion_range_g, range_basis] = portionRange(item, quantity, confidence);
    return {
      name: item.name.trim().slice(0, 160), quantity_g: quantity,
      calories, protein_g: number("protein_g", 2000),
      carbs_g: number("carbs_g", 2000), fat_g: number("fat_g", 2000),
      confidence, portion_range_g, range_basis,
      calorie_range: [round1(calories * portion_range_g[0] / quantity), round1(calories * portion_range_g[1] / quantity)] as [number, number],
    };
  });
  const sum = (key: "calories" | "protein_g" | "carbs_g" | "fat_g") =>
    Math.round(components.reduce((total, item) => total + item[key], 0) * 10) / 10;
  return {
    dish_name: typeof root?.dish_name === "string" ? root.dish_name.slice(0, 200) : components.map(c => c.name).join(", "),
    components, total_nutrition: { calories: sum("calories"), protein_g: sum("protein_g"), carbs_g: sum("carbs_g"), fat_g: sum("fat_g") },
    model, is_mock: false,
    calorie_range: [0, 1].map(i => round1(components.reduce((total, item) => total + item.calorie_range[i], 0))) as [number, number],
  };
}
