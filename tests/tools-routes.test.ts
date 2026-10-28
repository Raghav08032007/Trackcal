// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const jar = vi.hoisted(() => new Map<string, { value: string }>());
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => jar.get(key), set: (key: string, value: string) => jar.set(key, { value }), delete: (key: string) => jar.delete(key) }) }));
import { GET, POST } from "../src/app/api/tools/[action]/route";
const context = (action: string) => ({ params: Promise.resolve({ action }) });
beforeEach(() => { jar.clear(); vi.stubGlobal("fetch", vi.fn()); });
it("requires a session for server-powered tools", async () => { expect((await GET(new Request("http://localhost/api/tools/status"), context("status"))).status).toBe(401); expect(fetch).not.toHaveBeenCalled(); });
it("rejects foreign origins, unknown actions and invalid JSON before calling the API", async () => {
  expect((await POST(new Request("http://localhost/api/tools/plan", { method: "POST", headers: { Origin: "https://elsewhere.example" }, body: "{}" }), context("plan"))).status).toBe(403);
  expect((await GET(new Request("http://localhost/api/tools/admin"), context("admin"))).status).toBe(404);
  expect((await POST(new Request("http://localhost/api/tools/plan", { method: "POST", body: "{" }), context("plan"))).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
it("forwards only allowlisted queries with the server cookie token", async () => {
  jar.set("trackcal_access", { value: "test-access" }); const fetcher = vi.fn().mockResolvedValue(Response.json({ observations: [] })); vi.stubGlobal("fetch", fetcher);
  const response = await GET(new Request("http://localhost/api/tools/prices?code=3017620422003&currency=EUR&url=http://internal&api_key=private"), context("prices"));
  expect(response.status).toBe(200); const [url, init] = fetcher.mock.calls[0]; expect(url).toContain("code=3017620422003"); expect(url).not.toContain("internal"); expect(url).not.toContain("private"); expect(init.headers.Authorization).toBe("Bearer test-access"); expect(await response.text()).not.toContain("test-access");
});
it("keeps service setup errors visible instead of returning sample data", async () => {
  jar.set("trackcal_access", { value: "test-access" }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: "Grocy needs configuration" }, { status: 503 })));
  const result = await GET(new Request("http://localhost/api/tools/grocy"), context("grocy")); expect(result.status).toBe(503); expect(await result.json()).toEqual({ error: "Grocy needs configuration" });
});
