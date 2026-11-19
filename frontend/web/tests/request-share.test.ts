// Identical GETs in flight together share one request; saves are never shared and reset sharing; one caller's cancel
// affects only that caller; nothing is cached after the answer.
import { it, expect, vi } from "vitest";
import { sendLanguageToServer } from "@/lib/i18n";

function setup() {
  let release: (() => void) | null = null;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const calls: { url: string; method: string }[] = [];
  const target = {
    fetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? "GET" });
      await gate;
      return Response.json({ n: calls.length });
    }) as unknown as typeof fetch,
    location: { href: "http://app.test/today", origin: "http://app.test" },
  };
  sendLanguageToServer(target);
  return { target, calls, release: () => release!() };
}

it("shares identical GETs in flight and gives each caller a readable copy", async () => {
  const { target, calls, release } = setup();
  const a = target.fetch("/api/personalization/state"), b = target.fetch("/api/personalization/state"), c = target.fetch("/api/adventure/summary");
  release();
  const [ra, rb] = await Promise.all([a, b]); await c;
  expect(calls.filter(x => x.url === "/api/personalization/state")).toHaveLength(1);
  expect(await ra.json()).toEqual(await rb.json());
  await target.fetch("/api/personalization/state");   // after the answer: a fresh request, nothing cached
  expect(calls.filter(x => x.url === "/api/personalization/state")).toHaveLength(2);
});

it("never shares saves, and a GET after a save is a new request", async () => {
  const { target, calls, release } = setup();
  const before = target.fetch("/api/wellness/diary");
  const save1 = target.fetch("/api/wellness/diary", { method: "POST", body: "{}" }), save2 = target.fetch("/api/wellness/diary", { method: "POST", body: "{}" });
  const after = target.fetch("/api/wellness/diary");
  release(); await Promise.all([before, save1, save2, after]);
  expect(calls.filter(x => x.method === "POST")).toHaveLength(2);
  expect(calls.filter(x => x.method === "GET")).toHaveLength(2);
});

it("cancelling one caller leaves the other's answer intact", async () => {
  const { target, calls, release } = setup();
  const controller = new AbortController();
  const cancelled = target.fetch("/api/health/summary", { signal: controller.signal }), kept = target.fetch("/api/health/summary");
  controller.abort();
  await expect(cancelled).rejects.toBeTruthy();
  release();
  expect((await kept).ok).toBe(true);
  expect(calls).toHaveLength(1);
});

it("leaves other sites and non-api paths alone", async () => {
  const { target, calls, release } = setup(); release();
  await Promise.all([target.fetch("/photos/a.webp"), target.fetch("/photos/a.webp"), target.fetch("https://other.test/api/x"), target.fetch("https://other.test/api/x")]);
  expect(calls).toHaveLength(4);
});
