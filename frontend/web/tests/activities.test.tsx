// Activities on the web: formatting, keeping an unsaved recording, the map, and the record-then-save flow with a simulated GPS.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { dropPending, duration, keepPending, km, pace, readPending } from "@/lib/activities";
import { RouteMap, SplitBars } from "@/components/route-map";

describe("activity numbers", () => {
  it("formats time, distance, pace and speed", () => {
    expect(duration(65)).toBe("1:05");
    expect(duration(3725)).toBe("1:02:05");
    expect(km(5012)).toBe("5.01");
    expect(km(42195)).toBe("42.2");
    expect(pace("run", 5000, 1500)).toBe("5:00 /km");
    expect(pace("ride", 20000, 3600)).toBe("20.0 km/h");
    expect(pace("walk", 10, 60)).toBe("–");
  });
});

describe("an unsaved recording", () => {
  beforeEach(() => localStorage.clear());
  it("survives a reload and can be dropped", () => {
    keepPending({ id: "a".repeat(36), sport: "run", started_at: "2026-11-07T06:00:00Z", fixes: [[12.9, 77.5, 1, 5, null]], elapsed_ms: 1000 });
    expect(readPending()?.fixes).toHaveLength(1);
    dropPending();
    expect(readPending()).toBeNull();
  });
  it("ignores something broken in storage", () => {
    localStorage.setItem("trackcal:activity:pending", "{not json");
    expect(readPending()).toBeNull();
    localStorage.setItem("trackcal:activity:pending", JSON.stringify({ id: 4 }));
    expect(readPending()).toBeNull();
  });
});

describe("the map", () => {
  const route = Array.from({ length: 30 }, (_, i) => [12.97 + i * 0.0005, 77.59, i * 10, 900, i * 55.6] as [number, number, number, number, number]);
  it("draws the route with its ends for the owner, and a marker every kilometre", () => {
    const { container } = render(<RouteMap route={route} showEnds label="Map" />);
    expect(container.querySelector(".route-start")).toBeTruthy();
    expect(container.querySelectorAll(".route-km")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Map" })).toBeTruthy();
  });
  it("hides the ends on a shared route and explains an empty one", () => {
    const { container } = render(<RouteMap route={route} showEnds={false} label="Map" />);
    expect(container.querySelector(".route-start")).toBeNull();
    render(<RouteMap route={[]} showEnds={false} label="Empty" />);
    expect(screen.getByText(/No route to show/)).toBeTruthy();
  });
  it("marks the fastest split", () => {
    const { container } = render(<SplitBars sport="run" splits={[{ km: 1, distance_m: 1000, elapsed_s: 300, moving_s: 300, pace_s_per_km: 300 }, { km: 2, distance_m: 1000, elapsed_s: 280, moving_s: 280, pace_s_per_km: 280 }]} />);
    expect(container.querySelector("tr[data-fastest] td:nth-child(2)")?.textContent).toBe("4:40 /km");
  });
});

describe("recording and saving", () => {
  let emit: ((p: GeolocationPosition) => void) | null = null;
  const calls: { url: string; body: unknown }[] = [];
  beforeEach(() => {
    localStorage.clear(); calls.length = 0;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { watchPosition: (ok: (p: GeolocationPosition) => void) => { emit = ok; return 1; }, clearWatch: vi.fn() } });
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : undefined; calls.push({ url, body });
      if (url === "/api/account/session") return Response.json({ id: "u1", email: "a@tests.example.com" });
      if (url === "/api/activities" && init?.method === "POST") return Response.json({ activity: { id: body.id, sport: "run", name: "Morning run", distance_m: 1012, moving_s: 300, elapsed_s: 310, elevation_gain_m: 0, splits: [], best_efforts: [], route: [], mine: true }, new_records: [{ kind: "best_effort", label: "1 km", seconds: 296, previous_seconds: null }] }, { status: 201 });
      if (url.startsWith("/api/wellness/sessions/")) return Response.json({ awarded_xp: 20 });
      if (url === "/api/wellness/sessions") return Response.json({ session: { revision: 1 } });
      return Response.json({});
    }));
  });
  afterEach(() => { vi.useRealTimers(); });
  it("records fixes, saves them to the server, keeps them until saved and shows the new record", async () => {
    const { GpsTracker } = await import("@/components/gps-tracker");
    const { AccountSession } = await import("@/components/account-session");
    let clock = 1000; vi.spyOn(performance, "now").mockImplementation(() => clock);
    render(<AccountSession><GpsTracker /></AccountSession>);
    fireEvent.click(await screen.findByRole("button", { name: "Start run" }));
    await waitFor(() => expect(emit).toBeTruthy());
    const t0 = Date.now();
    act(() => { for (let k = 0; k < 120; k++) { clock += 1000; emit!({ coords: { latitude: 12.97, longitude: 77.59 + k * 0.00003, accuracy: 5, altitude: 900 }, timestamp: t0 + k * 1000 } as unknown as GeolocationPosition); } });
    expect(readPending()?.fixes.length).toBeGreaterThan(0);  // already safe on this device mid-run
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(readPending()?.fixes).toHaveLength(120);
    fireEvent.click(screen.getByRole("button", { name: "Save run" }));
    expect(await screen.findByText(/1 km/)).toBeTruthy();
    expect(screen.getByText("+20 points")).toBeTruthy();
    expect((calls.find(c => c.url === "/api/activities")!.body as { fixes: unknown[] }).fixes).toHaveLength(120);
    expect(readPending()).toBeNull();
  });
  it("offers to save a recording left over from last time, and sends every fix", async () => {
    keepPending({ id: "b".repeat(8) + "-bbbb-4bbb-8bbb-" + "b".repeat(12), sport: "run", started_at: new Date().toISOString(), fixes: Array.from({ length: 50 }, (_, k) => [12.97, 77.59 + k * 0.00003, k * 1000, 5, null]), elapsed_ms: 50000 });
    const { GpsTracker } = await import("@/components/gps-tracker");
    const { AccountSession } = await import("@/components/account-session");
    render(<AccountSession><GpsTracker /></AccountSession>);
    fireEvent.click(await screen.findByRole("button", { name: "Save it" }));
    expect(await screen.findByText(/New personal records|1 km/)).toBeTruthy();
    const sent = calls.find(c => c.url === "/api/activities")!.body as { fixes: unknown[]; sport: string };
    expect(sent.fixes).toHaveLength(50); expect(sent.sport).toBe("run");
    expect(readPending()).toBeNull();
    expect(calls.some(c => c.url.startsWith("/api/wellness/sessions/"))).toBe(true);  // points and streak
  });
  it("keeps the recording when saving fails", async () => {
    keepPending({ id: "c".repeat(8) + "-cccc-4ccc-8ccc-" + "c".repeat(12), sport: "walk", started_at: new Date().toISOString(), fixes: [[12.97, 77.59, 0, 5, null], [12.971, 77.59, 60000, 5, null]], elapsed_ms: 60000 });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/account/session" ? Response.json({ id: "u1", email: "a@tests.example.com" }) : Response.json({ error: "Activities are unavailable right now." }, { status: 503 })));
    const { GpsTracker } = await import("@/components/gps-tracker");
    const { AccountSession } = await import("@/components/account-session");
    render(<AccountSession><GpsTracker /></AccountSession>);
    fireEvent.click(await screen.findByRole("button", { name: "Save it" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/kept on this device/);
    expect(readPending()).not.toBeNull();
  });
});

describe("activities in the feed", () => {
  const post = { id: "p1", author: { handle: "asha", display_name: "Asha", character_id: "pip" }, body: "Sunrise loop", visibility: "followers" as const, created_at: new Date().toISOString(),
    reactions: { like: 2, cheer: 0, clap: 0, hug: 0 }, my_reaction: null, comment_count: 1, mine: false, hidden: false,
    milestone: { type: "activity", title: "Morning run", activity: { id: "a1", sport: "run" as const, distance_m: 5012, moving_s: 1500, elevation_gain_m: 42, records: ["1 km", "5 km"], preview: [[12.97, 77.59], [12.98, 77.6]] as [number, number][] } } };
  it("shows the route, the numbers and new records, and links to the activity", async () => {
    const { SocialPost } = await import("@/components/social-post");
    render(<SocialPost post={post} onChange={() => {}} onRemove={() => {}} />);
    const card = screen.getByRole("link", { name: /Morning run/ });
    expect(card.getAttribute("href")).toBe("/activities/a1");
    expect(card.textContent).toContain("5.01 km"); expect(card.textContent).toContain("4:59 /km"); expect(card.textContent).toContain("42 m");
    expect(card.textContent).toContain("2 new records");
    expect(screen.getByText("Sunrise loop")).toBeTruthy();
  });
});
