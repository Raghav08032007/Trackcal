interface Nutrient { nutrientName?: string; unitName?: string; value?: number; }
interface Food { fdcId: number; description: string; brandOwner?: string; brandName?: string; foodNutrients?: Nutrient[]; }
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100) return Response.json({ error: "Enter a food name between 2 and 100 characters." }, { status: 400 });
  try {
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key", process.env.USDA_API_KEY || "DEMO_KEY");
    url.searchParams.set("query", query); url.searchParams.set("pageSize", "12");
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return Response.json({ error: response.status === 429 ? "USDA search limit reached. Starter foods and manual entry remain available." : "USDA search is unavailable. Retry or use a starter food." }, { status: response.status === 429 ? 429 : 502 });
    const data = await response.json();
    const results = (Array.isArray(data.foods) ? data.foods : []).flatMap((food: Food) => {
      const get = (name: string, unit?: string) => food.foodNutrients?.find(n => n.nutrientName === name && (!unit || n.unitName?.toLowerCase() === unit))?.value;
      const calories = get("Energy", "kcal"), protein = get("Protein"), carbs = get("Carbohydrate, by difference"), fat = get("Total lipid (fat)");
      if ([calories, protein, carbs, fat].some(n => typeof n !== "number" || !Number.isFinite(n) || n < 0)) return [];
      const brand = food.brandOwner || food.brandName;
      return [{ id: `usda-${food.fdcId}`, name: brand ? `${food.description} — ${brand}` : food.description, cuisine: "USDA", category: "Food", serving_size: "100g", calories, protein, carbs, fat, fiber: get("Fiber, total dietary") || 0, source: "USDA FoodData Central", verified: false, allergens: [] }];
    });
    return Response.json({ results, source: "USDA FoodData Central", note: "Values per 100g. Allergen information is not provided by this search." });
  } catch { return Response.json({ error: "Food search timed out. Starter foods and manual entry remain available." }, { status: 502 }); }
}
