// Signed-in barcode flow: a completed (label-corrected) product is saved as a favourite with its per-100 g values.
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FoodWorkspace } from "../src/components/food-workspace";
vi.mock("@/lib/navigation", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/navigation")>()), useRouter: () => ({ push: vi.fn() }), usePathname: () => "/scanner" }));
vi.mock("@/components/account-session", async importOriginal => ({ ...(await importOriginal<typeof import("@/components/account-session")>()), useAccount: () => ({ ready: true, user: { id: "u1", name: "QA", email: "qa@example.com" } }) }));
function value(label: string, text: string) { fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: text } }); }
const product = { source: "Open Food Facts", barcode: "12345670", product_name: "Mystery bar", brand: "QA Foods", nova_group: null, serving_size: null, serving_g: null, complete: false, consistency_warning: false, allergens: [], cached: false, community_data: true, attribution: "Data from Open Food Facts contributors (ODbL).", nutrients_per_100g: { energy_kcal: 400, protein_g: 10, carbs_g: null, fat_g: 13, fiber_g: null, sugar_g: null, sodium_mg: null, saturated_fat_g: null } };

it("saves a corrected barcode product to the user's foods only once it is complete", async () => {
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async url => Response.json(String(url).includes("/api/barcode") ? product : { favorite: { id: "f1" } }));
  vi.stubGlobal("fetch", fetcher);
  render(<FoodWorkspace />);
  const picker = screen.getByText("Choose another food tool"); fireEvent.click(picker); fireEvent.click(screen.getByRole("button", { name: "Scan a barcode" }));
  value("Barcode number", "12345670"); fireEvent.click(screen.getByRole("button", { name: "Lookup Barcode" }));
  await screen.findByRole("heading", { name: "Mystery bar" });
  expect(screen.queryByRole("button", { name: "Save to my foods" })).toBeNull();
  value("Carbs per 100 g from the label", "60");
  fireEvent.click(screen.getByRole("button", { name: "Save to my foods" }));
  await screen.findByText(/Saved to your foods/);
  const call = fetcher.mock.calls.find(([url]) => String(url).endsWith("/api/wellness/favorites"))!;
  expect(JSON.parse(call[1]!.body as string)).toMatchObject({ food_key: "barcode-12345670", item: { name: "Mystery bar — QA Foods", grams: 100, nutrients: { calories: 400, protein: 10, carbs: 60, fat: 13 }, manual_override: true } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Save to my foods" }).hasAttribute("disabled")).toBe(false));
});
