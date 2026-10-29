import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { adventureRequest, forgetAdventureSummary } from "@/lib/adventure";

const summary = (xp: number) => Response.json({ initialized: true, xp });
beforeEach(() => { forgetAdventureSummary(); vi.useFakeTimers({ toFake: ["Date"] }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("shares one request between components that read the summary at the same time", async () => {
  const fetcher = vi.fn().mockResolvedValue(summary(10)); vi.stubGlobal("fetch", fetcher);
  const results = await Promise.all([adventureRequest("summary"), adventureRequest("summary"), adventureRequest("summary")]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(results).toEqual([{ initialized: true, xp: 10 }, { initialized: true, xp: 10 }, { initialized: true, xp: 10 }]);
});

it("reuses a result briefly, then asks again", async () => {
  const fetcher = vi.fn().mockImplementation(async () => summary(fetcher.mock.calls.length)); vi.stubGlobal("fetch", fetcher);
  await adventureRequest("summary"); await adventureRequest("summary");
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.setSystemTime(Date.now() + 2000);
  await adventureRequest("summary");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("any change clears the cache so the next read shows new XP", async () => {
  const fetcher = vi.fn().mockImplementation(async (url: string) => url.endsWith("/review") ? Response.json({ awarded_xp: 10 }) : summary(fetcher.mock.calls.length)); vi.stubGlobal("fetch", fetcher);
  await adventureRequest("summary");
  await adventureRequest("review", { id: "meal" });
  await adventureRequest("summary");
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/api/adventure/summary", "/api/adventure/review", "/api/adventure/summary"]);
});

it("a failed read is not reused", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: "busy" }, { status: 503 })).mockResolvedValueOnce(summary(5)); vi.stubGlobal("fetch", fetcher);
  await expect(adventureRequest("summary")).rejects.toThrow("busy");
  await expect(adventureRequest("summary")).resolves.toEqual({ initialized: true, xp: 5 });
});
