// Original tool/safety assertions now mount the shared component used by the dedicated food routes.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import {FoodWorkspace as Home} from "../src/components/food-workspace";
vi.mock("@/lib/navigation", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/navigation")>()),useRouter:()=>({push:vi.fn()}),usePathname:()=>"/scanner"}));
const journal = () => JSON.parse(localStorage.getItem(`trackcal:journal:${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(new Date().getDate()).padStart(2,"0")}`) || "[]");
function navigate(name: string) { const picker=screen.getByText("Choose another food tool").closest("details")!;if(!picker.open)fireEvent.click(screen.getByText("Choose another food tool"));fireEvent.click(screen.getByRole("button", { name })); }
function value(label: string, text: string) { fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: text } }); }
const inference = { dish_name: "Egg and toast", model: "test/free", components: [{ name: "Egg", quantity_g: 50, calories: 78, protein_g: 6, carbs_g: 1, fat_g: 5, confidence: .8, portion_range_g: [40, 65], range_basis: "model", calorie_range: [62.4, 101.4] }], total_nutrition: { calories: 78, protein_g: 6, carbs_g: 1, fat_g: 5 }, calorie_range: [62.4, 101.4], is_mock: false };
describe("complete feature flows", () => {
  it("shows no made-up meal and can't log anything before a scan", () => {
    render(<Home />);
    expect(screen.getByText("Waiting for a scan")).toBeTruthy();
    expect(screen.queryByText("Hyderabadi Chicken Biryani")).toBeNull();
    expect(screen.getByRole("button", { name: "Log This Meal" }).hasAttribute("disabled")).toBe(true);
  });
  it("labels a chosen demo meal as a sample", () => {
    render(<Home />); fireEvent.click(screen.getByRole("button", { name: /Avocado Egg Toast/ }));
    expect(screen.getByText("Sample result, not your meal")).toBeTruthy();
  });
  it("opens all six tools", () => { render(<Home />); for (const name of ["Barcode scan", "Describe a meal", "Food library", "My journal", "Recipe studio", "Food scanner"]) { navigate(name); expect(screen.getByRole("heading", { level: 1 })).toBeTruthy(); } });
  it("adds, edits, repeats, deletes and retains a manual meal across reloads", () => {
    render(<Home />); navigate("My journal"); value("Food name", "Regression meal"); value("calories", "123"); value("protein", "12.3"); fireEvent.click(screen.getByRole("button", { name: "Add meal" })); expect(journal()[0].calories).toBe(123);
    fireEvent.click(screen.getByRole("button", { name: "Edit" })); value("calories", "200"); fireEvent.click(screen.getByRole("button", { name: "Save correction" })); expect(journal()[0].calories).toBe(200);
    fireEvent.click(screen.getByRole("button", { name: "Repeat" })); expect(journal()).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]); expect(journal()).toHaveLength(1);
    cleanup(); render(<Home />); navigate("My journal"); expect(screen.getByRole("heading", { name: "Regression meal" })).toBeTruthy();
  });
  it("keeps journal dates and wellness fields isolated and persisted", () => {
    render(<Home />); navigate("My journal"); value("Journal date", "2026-10-01"); value("Food name", "October first meal"); value("calories", "250"); fireEvent.click(screen.getByRole("button", { name: "Add meal" })); fireEvent.click(screen.getByRole("button", { name: "+250 ml" })); value("Steps", "1234"); value("Weight (kg)", "74.5"); value("Activity", "Walk"); value("Workout minutes", "30");
    expect(JSON.parse(localStorage.getItem("trackcal:wellness:2026-10-01")!)).toMatchObject({ water: 250, steps: 1234, weight: 74.5, activity: "Walk", minutes: 30 });
    fireEvent.click(screen.getByRole("button", { name: "Undo 250 ml" })); expect(JSON.parse(localStorage.getItem("trackcal:wellness:2026-10-01")!).water).toBe(0);
    value("Journal date", "2026-10-02"); expect(screen.queryByRole("heading", { name: "October first meal" })).toBeNull(); expect((screen.getByLabelText("Steps") as HTMLInputElement).value).toBe("0");
    value("Journal date", "2026-10-01"); expect(screen.getByRole("heading", { name: "October first meal" })).toBeTruthy();
  });
  it("logs a scaled demo photo and cooking adjustment", () => {
    render(<Home />); fireEvent.click(screen.getByRole("button", { name: /Avocado Egg Toast/ })); fireEvent.change(screen.getByRole("slider"), { target: { value: "420" } }); fireEvent.click(screen.getByRole("button", { name: "Restaurant (Ghee/Butter Heavy)" })); fireEvent.click(screen.getByRole("button", { name: "Log This Meal" })); expect(journal()[0]).toMatchObject({ calories: 850, protein: 32, carbs: 56, fat: 55 });
  });
  it.each([
    ["Steamed / Boiled", 449, 10], ["Home-Cooked Light", 479, 13], ["Standard Recipe", 510, 15], ["Restaurant (Ghee/Butter Heavy)", 638, 22], ["Deep Fried", 755, 28],
  ])("logs the %s cooking estimate", (name, calories, fat) => {
    render(<Home />); fireEvent.click(screen.getByRole("button", { name: /Chicken Biryani Plate/ })); fireEvent.click(screen.getByRole("button", { name: String(name) })); fireEvent.click(screen.getByRole("button", { name: "Log This Meal" })); expect(journal()[0]).toMatchObject({ calories, fat });
  });
  it("keeps a new photo local until explicit provider consent", async () => {
    const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);render(<Home/>);
    fireEvent.change(screen.getByLabelText("Meal or nutrition label photo"),{target:{files:[new File(["local synthetic preview"],"private.png",{type:"image/png"})]}});
    await screen.findByRole("alert");expect(fetcher).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"Log This Meal"}).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button",{name:"Delete selected photo"}));expect(fetcher).not.toHaveBeenCalled();
  });
  it("uploads actual image bytes, receives an estimate and logs it", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(inference)); vi.stubGlobal("fetch", fetcher); render(<Home />);fireEvent.click(screen.getByLabelText("Allow this photo to be sent to the configured AI provider"));
    fireEvent.change(screen.getByLabelText("Meal or nutrition label photo"), { target: { files: [new File(["synthetic test pixels"], "meal.png", { type: "image/png" })] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Log This Meal" }).hasAttribute("disabled")).toBe(false)); expect(screen.getByRole("note").textContent).toContain("Likely 40–65 g (about 62–101 kcal) · High confidence"); fireEvent.click(screen.getByRole("button", { name: "Log This Meal" })); expect(journal()[0].calories).toBe(78); expect(JSON.parse(fetcher.mock.calls[0][1].body).image).toMatch(/^data:image\/png;base64,/);
  });
  it("blocks saving stale nutrition when photo analysis fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Provider unavailable" }, { status: 502 }))); render(<Home />);fireEvent.click(screen.getByLabelText("Allow this photo to be sent to the configured AI provider")); fireEvent.change(screen.getByLabelText("Meal or nutrition label photo"), { target: { files: [new File(["test"], "meal.png", { type: "image/png" })] } }); await screen.findByRole("alert"); expect(screen.getByRole("button", { name: "Log This Meal" }).hasAttribute("disabled")).toBe(true); expect(journal()).toHaveLength(0);
  });
  it("parses text and saves the returned nutrition", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(inference))); render(<Home />); navigate("Describe a meal"); value("Meal description", "One egg"); fireEvent.click(screen.getByRole("button", { name: "Parse & Break Down Meal" })); await screen.findByRole("button", { name: "+ Log All to Journal" }); fireEvent.click(screen.getByRole("button", { name: "+ Log All to Journal" })); expect(journal()[0]).toMatchObject({ calories: 78, protein: 6 });
  });
  it("shows text failure and never offers fabricated results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Rate limited" }, { status: 429 }))); render(<Home />); navigate("Describe a meal"); value("Meal description", "One egg"); fireEvent.click(screen.getByRole("button", { name: "Parse & Break Down Meal" })); await screen.findByRole("alert"); expect(screen.queryByRole("button", { name: "+ Log All to Journal" })).toBeNull();
  });
  it("looks up a barcode and scales every nutrient consistently", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ source: "Open Food Facts", barcode: "12345678", product_name: "Test yogurt", nova_group: null, serving_size: "100g", nutrients_per_100g: { energy_kcal: 200, protein_g: 12, carbs_g: 20, fat_g: 8 }, allergens: [] })));
    render(<Home />); navigate("Barcode scan"); value("Barcode number", "12345678"); fireEvent.click(screen.getByRole("button", { name: "Lookup Barcode" })); await screen.findByRole("heading", { name: "Test yogurt" }); value("Barcode amount in grams", "50"); fireEvent.click(screen.getByRole("button", { name: "+ Log to Journal" })); expect(journal()[0]).toMatchObject({ calories: 100, protein: 6, carbs: 10, fat: 4 });
  });
  it("shows unknown barcode values as label inputs and logs only once they are filled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ source: "Open Food Facts", barcode: "12345670", product_name: "Mystery bar", brand: null, nova_group: null, serving_size: null, serving_g: null, complete: false, consistency_warning: false, allergens: [], cached: false, community_data: true, attribution: "Data from Open Food Facts contributors (ODbL).", nutrients_per_100g: { energy_kcal: 400, protein_g: 10, carbs_g: null, fat_g: null, fiber_g: null, sugar_g: null, sodium_mg: null, saturated_fat_g: null } })));
    render(<Home />); navigate("Barcode scan"); value("Barcode number", "12345670"); fireEvent.click(screen.getByRole("button", { name: "Lookup Barcode" }));
    await screen.findByRole("heading", { name: "Mystery bar" });
    const log = screen.getByRole("button", { name: "+ Log to Journal" });
    expect(log.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Enter the missing values from the packaging label/)).toBeTruthy();
    expect(screen.getByText(/Data from Open Food Facts contributors/)).toBeTruthy();
    value("Carbs per 100 g from the label", "60"); expect(log.hasAttribute("disabled")).toBe(true);
    value("Fat per 100 g from the label", "13"); expect(log.hasAttribute("disabled")).toBe(false);
    value("Barcode amount in grams", "50"); fireEvent.click(log);
    expect(journal()[0]).toMatchObject({ calories: 200, protein: 5, carbs: 30, fat: 6.5 });
  });
  it("warns when a product's values do not add up", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ source: "Open Food Facts", barcode: "96385074", product_name: "Odd label", brand: "QA", nova_group: null, serving_size: "30 g", serving_g: 30, complete: true, consistency_warning: true, allergens: [], cached: true, community_data: true, attribution: "Data from Open Food Facts contributors (ODbL).", nutrients_per_100g: { energy_kcal: 100, protein_g: 10, carbs_g: 50, fat_g: 20, fiber_g: null, sugar_g: null, sodium_mg: null, saturated_fat_g: null } })));
    render(<Home />); navigate("Barcode scan"); value("Barcode number", "96385074"); fireEvent.click(screen.getByRole("button", { name: "Lookup Barcode" }));
    await screen.findByRole("heading", { name: "Odd label" });
    expect(screen.getByText(/These values don.t add up/)).toBeTruthy();
    expect(screen.getByText(/saved copy/)).toBeTruthy();
  });
  it("invalid barcode prevents logging a stale prior product", async () => {
    render(<Home />); navigate("Barcode scan"); value("Barcode number", "invalid"); fireEvent.click(screen.getByRole("button", { name: "Lookup Barcode" })); await screen.findByRole("alert"); expect(screen.getByRole("button", { name: "+ Log to Journal" }).hasAttribute("disabled")).toBe(true);
  });
  it("filters the food library and logs the chosen food", () => {
    render(<Home />); navigate("Food library"); fireEvent.change(screen.getByPlaceholderText("Search food, cuisine, allergen..."), { target: { value: "Paneer" } }); fireEvent.click(screen.getByRole("button", { name: /^Log / })); expect(journal()[0].name).toContain("Paneer");
  });
  it("searches allergens and explains empty library results", () => {
    render(<Home />); navigate("Food library"); const search = screen.getByPlaceholderText("Search food, cuisine, allergen..."); fireEvent.change(search, { target: { value: "Gluten" } }); expect(screen.getAllByRole("button", { name: /^Log / })).toHaveLength(3); fireEvent.change(search, { target: { value: "unfindable synthetic query" } }); expect(screen.getByText(/No matching foods/)).toBeTruthy();
  });
  it("searches the global catalog and logs a returned 100g food", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ results: [{ id: "usda-1", name: "Global test food", cuisine: "USDA", category: "Food", serving_size: "100g", calories: 89, protein: 1.1, carbs: 22.8, fat: .3, fiber: 2.6, source: "USDA FoodData Central", verified: false, allergens: [] }] })));
    render(<Home />); navigate("Food library"); fireEvent.change(screen.getByPlaceholderText("Search food, cuisine, allergen..."), { target: { value: "banana" } }); fireEvent.click(screen.getByRole("button", { name: "Search global foods" })); await screen.findByText("Global test food"); fireEvent.click(screen.getByRole("button", { name: /^Log / })); expect(journal()[0]).toMatchObject({ name: "Global test food (100 g)", calories: 89 });
  });
  it("adds ingredients, changes yield, removes ingredients and logs a recipe", () => {
    render(<Home />); navigate("Recipe studio"); for (const name of ["Boneless Chicken Breast", "Olive Oil", "Jasmine Rice (Dry)", "Broccoli Florets"]) fireEvent.click(screen.getByRole("button", { name: `Remove ${name}` }));
    value("Recipe name", "Test recipe"); value("Ingredient name", "Test oats"); value("Ingredient grams", "100"); value("Ingredient Calories (kcal)", "200"); value("Ingredient Protein (g)", "10"); value("Ingredient Carbs (g)", "30"); value("Ingredient Fat (g)", "4"); fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease recipe servings" })); fireEvent.click(screen.getByRole("button", { name: "Log one serving" })); expect(journal()[0]).toMatchObject({ calories: 200, protein: 10, carbs: 30, fat: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Increase recipe servings" })); expect(JSON.parse(localStorage.getItem("trackcal:recipe:servings")!)).toBe(2);
  });
  it("validates goals and applies muscle gain rather than maintenance", async () => {
    render(<Home />); fireEvent.click(screen.getAllByRole("button", { name: /My goals|My nutrition goals/ })[0]); const dialog = screen.getByRole("dialog"); value("Goal age", "0"); fireEvent.click(within(dialog).getByRole("button", { name: "Calculate & Apply Targets" })); await screen.findByRole("alert"); value("Goal age", "28"); value("Goal weight kg", "75"); value("Goal height cm", "180"); fireEvent.click(screen.getByRole("button", { name: "Muscle Gain (+300)" })); fireEvent.click(screen.getByRole("button", { name: "Calculate & Apply Targets" })); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); expect(JSON.parse(localStorage.getItem("trackcal:target:calories")!)).toBe(2997);
  });
  it("tolerates corrupted persisted journal data", () => { const now = new Date(); const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; localStorage.setItem(`trackcal:journal:${date}`, "null"); render(<Home />); navigate("My journal"); expect(screen.getByText("No meals yet. Add one above or log a reviewed scan.")).toBeTruthy(); });
  it("focuses the goal dialog and closes it with Escape", () => { render(<Home />); fireEvent.click(screen.getByRole("button", { name: "My goals" })); const dialog = screen.getByRole("dialog"); expect(dialog.contains(document.activeElement)).toBe(true); fireEvent.keyDown(dialog, { key: "Escape" }); expect(screen.queryByRole("dialog")).toBeNull(); });
});
