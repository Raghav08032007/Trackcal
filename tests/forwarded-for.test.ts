import { afterEach, expect, it, vi } from "vitest";
let incoming: Record<string, string> = {};
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers(incoming) }));
import { upstream } from "@/lib/server-account";

afterEach(() => { incoming = {}; vi.unstubAllGlobals(); });

it("passes the proxy-recorded client address to the API for per-IP limits", async () => {
  incoming = { "x-forwarded-for": "198.51.100.7" }; const fetcher = vi.fn().mockResolvedValue(Response.json({})); vi.stubGlobal("fetch", fetcher);
  await upstream("/auth/login", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  expect(fetcher.mock.calls[0][1].headers).toEqual({ "Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": "198.51.100.7" });
});

it("adds nothing when the request did not come through a proxy", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({})); vi.stubGlobal("fetch", fetcher);
  await upstream("/auth/me", { headers: { Authorization: "Bearer t" } });
  expect(fetcher.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer t" });
});
