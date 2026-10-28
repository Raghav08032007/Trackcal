export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") || "";
  if (!/^\d{8,14}$/.test(code)) return Response.json({ error: "Enter an 8–14 digit UPC/EAN barcode." }, { status: 400 });
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, { headers: { "User-Agent": "TrackCal/1.0 (local nutrition journal)" }, signal: AbortSignal.timeout(12000) });
    if (response.status === 404) return Response.json({ error: "Product not found. Enter its nutrition manually in your journal." }, { status: 404 });
    if (!response.ok) return Response.json({ error: "Open Food Facts is unavailable. Retry later or enter nutrition manually." }, { status: 502 });
    const data = await response.json();
    if (data.status !== 1 || !data.product) return Response.json({ error: "Product not found. Enter its nutrition manually in your journal." }, { status: 404 });
    const p = data.product, n = p.nutriments || {};
    const calories = n["energy-kcal_100g"] ?? (n.energy_100g === undefined ? undefined : Number(n.energy_100g) / 4.184);
    const values = [calories, n.proteins_100g, n.carbohydrates_100g, n.fat_100g];
    if (values.some(v => v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0)) return Response.json({ error: "This product has incomplete nutrition. Use the packaging label and manual entry." }, { status: 422 });
    return Response.json({ source: "Open Food Facts", barcode: code, product_name: p.product_name || "Packaged food", brand: p.brands || "", serving_size: p.serving_size || "100g", nova_group: [1, 2, 3, 4].includes(p.nova_group) ? p.nova_group : null,
      nutrients_per_100g: { energy_kcal: Number(calories), protein_g: Number(n.proteins_100g), carbs_g: Number(n.carbohydrates_100g), fat_g: Number(n.fat_100g), fiber_g: Number(n.fiber_100g) || 0 }, allergens: Array.isArray(p.allergens_tags) ? p.allergens_tags.filter((tag: unknown) => typeof tag === "string").map((tag: string) => tag.replace(/^[a-z]{2}:/, "").replaceAll("-", " ")) : [], ingredients_text: p.ingredients_text || "" });
  } catch { return Response.json({ error: "Product lookup timed out or lost its connection. Retry or log manually." }, { status: 502 }); }
}
