import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import Tools from "../src/app/tools/page";
import { matchesDiet, compareFoodCost, recipeTotals, type SavedRecipe } from "../src/lib/smart-tools";
const ingredient = { id: "rice", name: "Rice", grams: 100, calories: 400, protein: 10, carbs: 80, fat: 2, original: "100 g rice", source: "User entered" };
const recipe: SavedRecipe = { id: "bowl", name: "Rice bowl", servings: 2, cost: 50, currency: "INR", minutes: 20, tags: [], instructions: "Cook", ingredients: [ingredient], totals: { calories: 200, protein: 5, carbs: 40, fat: 1 } };
it("compares reviewed pack prices without dividing by zero or inventing a pack weight", () => { expect(compareFoodCost(100, 500, 100, 10)).toEqual({ per100: 20, perServing: 20, per20gProtein: 40 }); expect(compareFoodCost(100, 500, 100, 0).per20gProtein).toBeNull(); expect(() => compareFoodCost(100, 0, 100, 10)).toThrow(); });
it("does not invent nutrition or convert an unmeasured ingredient", () => {
  expect(() => recipeTotals([{ ...ingredient, grams: null }], 2)).toThrow(/gram/);
  expect(() => recipeTotals([{ ...ingredient, protein: null }], 2)).toThrow(/nutrition/);
  expect(recipeTotals([ingredient], 2)).toEqual(recipe.totals);
});
it("saves a reviewed recipe to both the library and existing Recipe Studio", async () => {
  const user = userEvent.setup(); render(<Tools />);
  await user.click(screen.getByRole("button", { name: "Add ingredient" }));
  fireEvent.change(screen.getByLabelText("Recipe name"), { target: { value: "Rice bowl" } });
  fireEvent.change(screen.getByLabelText("Servings"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Whole-recipe cost"), { target: { value: "50" } });
  fireEvent.change(screen.getByLabelText("Ingredient 1"), { target: { value: "Rice" } });
  for (const [label, value] of [["Grams 1", "100"], ["calories 1", "400"], ["protein 1", "10"], ["carbs 1", "80"], ["fat 1", "2"]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await user.click(screen.getByRole("button", { name: "Save reviewed recipe" }));
  await waitFor(() => expect(screen.getByText(/Reviewed recipe saved/)).toBeTruthy());
  expect(JSON.parse(localStorage.getItem("trackcal:studio:recipes")!)[0].totals.calories).toBe(200);
  expect(JSON.parse(localStorage.getItem("trackcal:recipe:ingredients")!)[0].cal).toBe(400);
});
it("rejects an unreviewed recipe instead of storing zero nutrition", async () => {
  render(<Tools />); fireEvent.click(screen.getByRole("button", { name: "Add ingredient" }));
  fireEvent.click(screen.getByRole("button", { name: "Save reviewed recipe" }));
  expect((await screen.findByRole("alert")).textContent).toContain("gram"); expect(localStorage.getItem("trackcal:studio:recipes")).toBeNull();
});
it("imports parsed ingredients while preserving unknown weights and source yield", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ name: "Imported bowl", yield_text: "4 servings", ingredients: [{ name: "Rice", original: "1 cup rice", grams: null }] })));
  const user = userEvent.setup(); render(<Tools />);
  await user.type(screen.getByLabelText("Recipe URL"), "https://example.com/recipe"); await user.click(screen.getByRole("button", { name: "Import recipe URL" }));
  await waitFor(() => expect((screen.getByLabelText("Recipe name") as HTMLInputElement).value).toBe("Imported bowl"));
  expect((screen.getByLabelText("Grams 1") as HTMLInputElement).value).toBe("");
  expect(screen.getByText(/Source yield: 4 servings/)).toBeTruthy();
});
it("generates a plan, logs one serving and builds a pantry-adjusted shopping list", async () => {
  localStorage.setItem("trackcal:studio:recipes", JSON.stringify([recipe]));
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ status: "optimal", meals: [{ id: recipe.id, name: recipe.name, ...recipe.totals, cost: 25, minutes: 20 }], totals: { ...recipe.totals, cost: 25, minutes: 20 }, currency: "INR" })).mockResolvedValueOnce(Response.json({ items: [{ name: "Rice", needed_g: 50, available_g: 20, buy_g: 30 }], expired_excluded: 0 })); vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup(); render(<Tools />); await user.click(screen.getByRole("button", { name: "Meal planner" })); await user.click(screen.getByRole("button", { name: "Generate meal plan" }));
  await user.click(await screen.findByRole("button", { name: "Log Rice bowl" }));
  expect(Object.keys(localStorage).some(key => key.startsWith("trackcal:journal:"))).toBe(true);
  await user.click(screen.getByRole("button", { name: "Build shopping list" }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem("trackcal:studio:shopping")!)[0].buy_g).toBe(30));
  await user.click(screen.getByRole("button", { name: "Pantry & prices" })); expect(screen.getByText(/buy 30g/)).toBeTruthy();
  await user.click(screen.getByRole("checkbox")); expect(JSON.parse(localStorage.getItem("trackcal:studio:shopping")!)[0].checked).toBe(true);
  await user.click(screen.getByRole("button", { name: "Meal planner" })); expect(screen.getByRole("button", { name: "Log Rice bowl" })).toBeTruthy();
});
it("records and consumes pantry stock, and saves a real workout record", async () => {
  const user = userEvent.setup(); render(<Tools />); await user.click(screen.getByRole("button", { name: "Pantry & prices" }));
  await user.type(screen.getByLabelText("Pantry food"), "Rice"); await user.click(screen.getByRole("button", { name: "Add to pantry" }));
  expect(screen.getByText("Rice · 100g")).toBeTruthy(); await user.click(screen.getByRole("button", { name: "Use up to 100g" })); expect(JSON.parse(localStorage.getItem("trackcal:studio:pantry")!)).toEqual([]);
  await user.click(screen.getByRole("button", { name: "Workouts" })); await user.type(screen.getByLabelText("Workout name"), "Walk"); await user.click(screen.getByRole("button", { name: "Save workout" }));
  expect(JSON.parse(localStorage.getItem("trackcal:studio:workouts")!)[0].name).toBe("Walk");
});
it("manual label logging works without OCR while an unknown basis is rejected", async () => {
  const user = userEvent.setup(); render(<Tools />); await user.click(screen.getByRole("button", { name: "Label & voice" }));
  await user.type(screen.getByLabelText("Product name"), "Yogurt");
  for (const label of ["calories (kcal)", "protein (g)", "carbs (g)", "fat (g)"]) fireEvent.change(screen.getByLabelText(label), { target: { value: "10" } });
  await user.click(screen.getByRole("button", { name: "Log reviewed label" })); expect((await screen.findByRole("alert")).textContent).toContain("basis");
  await user.selectOptions(screen.getByLabelText("Label basis"), "per_100g"); await user.click(screen.getByRole("button", { name: "Log reviewed label" }));
  await waitFor(() => expect(screen.getByText(/Meal saved to/)).toBeTruthy());
});
it("keeps empty and failed price requests honest", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ observations: [] })));
  const user = userEvent.setup(); render(<Tools />); await user.click(screen.getByRole("button", { name: "Pantry & prices" }));
  await user.type(screen.getByLabelText("Product barcode"), "3017620422003"); await user.click(screen.getByRole("button", { name: "Find price observations" }));
  expect(await screen.findByText(/No observations available/)).toBeTruthy();
});

it("requires explicit reviewed diet tags rather than guessing from a recipe name",()=>{expect(matchesDiet([],"vegan")).toBe(false);expect(matchesDiet(["vegan"],"vegetarian")).toBe(true);expect(matchesDiet(["vegetarian"],"vegan")).toBe(false);expect(matchesDiet([],"balanced")).toBe(true);});
