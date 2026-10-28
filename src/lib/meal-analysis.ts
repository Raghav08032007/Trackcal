export interface MealComponent {
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
}

export interface MealAnalysis {
  dish_name: string;
  components: MealComponent[];
  total_nutrition: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  model: string;
  is_mock: false;
}

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
    return {
      name: item.name.trim().slice(0, 160), quantity_g: number("quantity_g", 10000),
      calories: number("calories", 20000), protein_g: number("protein_g", 2000),
      carbs_g: number("carbs_g", 2000), fat_g: number("fat_g", 2000),
      confidence: typeof item.confidence === "number" && Number.isFinite(item.confidence)
        ? Math.max(0, Math.min(1, item.confidence)) : 0,
    };
  });
  const sum = (key: "calories" | "protein_g" | "carbs_g" | "fat_g") =>
    Math.round(components.reduce((total, item) => total + item[key], 0) * 10) / 10;
  return {
    dish_name: typeof root?.dish_name === "string" ? root.dish_name.slice(0, 200) : components.map(c => c.name).join(", "),
    components, total_nutrition: { calories: sum("calories"), protein_g: sum("protein_g"), carbs_g: sum("carbs_g"), fat_g: sum("fat_g") },
    model, is_mock: false,
  };
}
