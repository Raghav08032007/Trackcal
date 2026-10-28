// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/analyze/route";
import { GET } from "../src/app/api/barcode/route";
import { GET as searchFoods } from "../src/app/api/foods/route";
const item = { name: "Egg", quantity_g: 50, calories: 78, protein_g: 6.3, carbs_g: .6, fat_g: 5.3, confidence: .8 };
const request = (body: unknown, origin?: string) => new Request("http://localhost/api/analyze", { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
beforeEach(() => { vi.stubEnv("OPENROUTER_API_KEY", "unit-test-key"); vi.stubEnv("NODE_ENV", "test"); });
describe("AI route", () => {
  it.each([null, [], {}, { text: "" }, { text: "x".repeat(4001) }, { image: "data:text/html;base64,aGVsbG8=" }])("rejects invalid body %j", async body => { expect((await POST(request(body))).status).toBe(400); });
  it("rejects malformed JSON", async () => { expect((await POST(new Request("http://localhost/api/analyze", { method: "POST", body: "{" }))).status).toBe(400); });
  it("rejects a spoofed PNG without calling the provider", async () => { const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); expect((await POST(request({ image: "data:image/png;base64,aGVsbG8=" }))).status).toBe(400); expect(fetcher).not.toHaveBeenCalled(); });
  it("rejects foreign origins", async () => { expect((await POST(request({ text: "Egg" }, "https://untrusted.invalid"))).status).toBe(403); });
  it("accepts the browser Host when Next normalizes its internal URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ components: [item] }) } }] })));
    const browserRequest = new Request("http://localhost:3002/api/analyze", { method: "POST", headers: { host: "127.0.0.1:3002", origin: "http://127.0.0.1:3002", "Content-Type": "application/json" }, body: JSON.stringify({ text: "Egg" }) });
    expect((await POST(browserRequest)).status).toBe(200);
  });
  it("requires server configuration", async () => { vi.stubEnv("OPENROUTER_API_KEY", ""); expect((await POST(request({ text: "Egg" }))).status).toBe(503); });
  it("is disabled by default for public production", async () => { vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("ENABLE_LOCAL_AI", ""); expect((await POST(request({ text: "Egg" }))).status).toBe(503); });
  it("returns recomputed nutrition and keeps credentials out of the response", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ model: "test/free", choices: [{ message: { content: JSON.stringify({ components: [item] }) } }] })); vi.stubGlobal("fetch", fetcher);
    const response = await POST(request({ text: "Egg" })); expect(response.status).toBe(200);
    const data = await response.json(); expect(data.total_nutrition.calories).toBe(78); expect(data.is_mock).toBe(false); expect(JSON.stringify(data)).not.toContain("unit-test-key");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe("openrouter/free");
  });
  it.each([401, 429, 503])("provider %i is a visible, sanitized error", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private upstream credential details", { status })));
    const response = await POST(request({ text: "Egg" })); expect(response.status).toBe(status === 429 ? 429 : 502); expect(await response.text()).not.toContain("private upstream");
  });
  it("does not replace malformed model output with food", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "not JSON" } }] }))); expect((await POST(request({ text: "Egg" }))).status).toBe(502); });
  it("retries one malformed model response and requests JSON mode", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "invalid" } }] })).mockResolvedValueOnce(Response.json({ choices: [{ message: { content: JSON.stringify({ components: [item] }) } }] }));
    vi.stubGlobal("fetch", fetcher); expect((await POST(request({ text: "Egg" }))).status).toBe(200); expect(fetcher).toHaveBeenCalledTimes(2); expect(JSON.parse(fetcher.mock.calls[0][1].body).response_format.type).toBe("json_object");
  });
  it("limits concurrent scans and releases its slots after completion", async () => {
    const finish: ((value: Response) => void)[] = [];
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => finish.push(resolve))));
    const first = POST(request({ text: "Egg" })); const second = POST(request({ text: "Toast" }));
    await vi.waitFor(() => expect(finish).toHaveLength(2));
    expect((await POST(request({ text: "Third meal" }))).status).toBe(429);
    finish.forEach(resolve => resolve(Response.json({ choices: [{ message: { content: JSON.stringify({ components: [item] }) } }] })));
    expect((await Promise.all([first, second])).map(response => response.status)).toEqual([200, 200]);
  });
});
describe("barcode route", () => {
  const url = (code: string) => new Request(`http://localhost/api/barcode?code=${code}`);
  it.each(["abc", "123", "../foo"]) ("rejects invalid barcode %s", async code => { expect((await GET(url(code))).status).toBe(400); });
  it("keeps legitimate zero values and unknown NOVA", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: 1, product: { product_name: "Water", nutriments: { "energy-kcal_100g": 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 } } }))); const response = await GET(url("3017620422003")); const data = await response.json(); expect(response.status).toBe(200); expect(data.nutrients_per_100g.energy_kcal).toBe(0); expect(data.nova_group).toBeNull(); });
  it("rejects missing nutrients rather than inventing zeros", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: 1, product: { nutriments: {} } }))); expect((await GET(url("3017620422003"))).status).toBe(422); });
  it("reports not found", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: 0 }))); expect((await GET(url("3017620422003"))).status).toBe(404); });
  it("reports timeouts", async () => { vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout"))); expect((await GET(url("3017620422003"))).status).toBe(502); });
});
describe("global food search", () => {
  it("rejects an empty query", async () => { expect((await searchFoods(new Request("http://localhost/api/foods?q="))).status).toBe(400); });
  it("returns complete nutrition per 100g and skips incomplete records", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ foods: [
      { fdcId: 1, description: "Test banana", foodNutrients: [{ nutrientName: "Energy", unitName: "KCAL", value: 89 }, { nutrientName: "Protein", value: 1.1 }, { nutrientName: "Carbohydrate, by difference", value: 22.8 }, { nutrientName: "Total lipid (fat)", value: .3 }] },
      { fdcId: 2, description: "Incomplete", foodNutrients: [] },
    ] })));
    const response = await searchFoods(new Request("http://localhost/api/foods?q=banana")); const data = await response.json(); expect(data.results).toHaveLength(1); expect(data.results[0]).toMatchObject({ name: "Test banana", calories: 89, serving_size: "100g" });
  });
  it("reports a limited free demo key", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("limit", { status: 429 }))); expect((await searchFoods(new Request("http://localhost/api/foods?q=banana"))).status).toBe(429); });
  it("reports connection failure without fabricated food", async () => { vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline"))); expect((await searchFoods(new Request("http://localhost/api/foods?q=banana"))).status).toBe(502); });
});
