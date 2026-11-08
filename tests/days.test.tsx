// A day of water, burn, sleep and mood: one copy from the account for every screen, taps sent as amounts,
// kept in an outbox while offline, and browser-only days copied once.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
const account = vi.hoisted(() => ({ id: "" }));
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: account.id ? { id: account.id } : null }), useWorkspaceScope: () => account.id || "guest" }));
import { blankDay, resetDays, useBurn, useCheckins, useWellness, type Day } from "@/lib/days";

const DATE = "2026-11-08";
let server: Day, calls: { method: string; url: string; body?: Record<string, unknown> }[] = [], offline = false;
let setWater: ((f: (w: { water: number }) => never) => void) | null = null, setBurn: ((f: (n: number) => number) => void) | null = null;

function Water({ id }: { id: string }) { const [w, set] = useWellness(DATE); if (id === "a") setWater = set as never; return <p data-testid={id}>{w.water}/{w.waterGoal}</p>; }
function Burn() { const [b, set] = useBurn(DATE); setBurn = set; return <p data-testid="burn">{b}</p>; }
function Feel() { const [c] = useCheckins(); return <p data-testid="feel">{c.map(x => x.date + ":" + x.energy).join(",")}</p>; }

describe("a day in the account", () => {
  beforeEach(() => {
    resetDays(); localStorage.clear(); calls = []; offline = false; account.id = "member";
    server = { ...blankDay(DATE), water_goal_ml: 2400 };
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET", body = init?.body ? JSON.parse(String(init.body)) : undefined; calls.push({ method, url, body });
      if (offline) throw new TypeError("Failed to fetch");
      if (url.endsWith("/import")) return Response.json({ imported: body.days.length });
      if (url.endsWith("/days")) return Response.json({ today: DATE, days: [server] });
      if (method === "POST") { server = { ...server, saved: true, water_ml: server.water_ml + (body.add?.water_ml ?? 0), burn_kcal: server.burn_kcal + (body.add?.burn_kcal ?? 0), energy: body.set?.energy ?? server.energy, sore: body.set?.sore ?? server.sore }; server.burned_total = Math.round(server.burn_kcal + server.route_kcal); }
      return Response.json(server);
    }));
  });

  it("every screen shows the account's day, and a tap is sent as an amount", async () => {
    render(<><Water id="a" /><Water id="b" /></>);
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("0/2400"));
    act(() => setWater!(w => ({ ...w, water: w.water + 250 }) as never));
    expect(screen.getByTestId("b").textContent).toBe("250/2400");                     // shown straight away
    await waitFor(() => expect(calls.some(c => c.method === "POST" && c.body?.add)).toBe(true));
    expect(calls.find(c => c.method === "POST")!.body).toEqual({ set: {}, add: { water_ml: 250 } });
    expect(calls.filter(c => c.method === "GET" && c.url.endsWith(DATE))).toHaveLength(1);   // one load for both screens
  });

  it("offline taps wait and are sent when the connection is back", async () => {
    render(<Water id="a" />);
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("0/2400"));
    offline = true;
    act(() => setWater!(w => ({ ...w, water: w.water + 250 }) as never));
    act(() => setWater!(w => ({ ...w, water: w.water + 250 }) as never));
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("500/2400"));
    expect(JSON.parse(localStorage.getItem("trackcal-outbox:days:member")!)).toHaveLength(2);
    offline = false;
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(server.water_ml).toBe(500));
    expect(localStorage.getItem("trackcal-outbox:days:member")).toBeNull();
    expect(screen.getByTestId("a").textContent).toBe("500/2400");
  });

  it("calories burned add the difference, on top of recorded routes", async () => {
    server = { ...server, route_kcal: 300, burned_total: 300 };
    render(<Burn />);
    await waitFor(() => expect(screen.getByTestId("burn").textContent).toBe("300"));
    act(() => setBurn!(v => v + 45.5));
    await waitFor(() => expect(server.burn_kcal).toBe(45.5));
    expect(screen.getByTestId("burn").textContent).toBe("346");
  });

  it("days that were only in this browser are copied once, then removed from it", async () => {
    localStorage.setItem("trackcal:account:member:trackcal:wellness:2026-11-01", JSON.stringify({ water: 750, waterGoal: 2000, steps: 0, activity: "Walk", minutes: 20, weight: 0 }));
    localStorage.setItem("trackcal:account:member:trackcal:burn:2026-11-01", "120");
    localStorage.setItem("trackcal:account:member:trackcal:studio:checkins", JSON.stringify([{ date: "2026-11-02", energy: "low", sore: "bit" }]));
    render(<Water id="a" />);
    await waitFor(() => expect(calls.some(c => c.url.endsWith("/import"))).toBe(true));
    expect(calls.find(c => c.url.endsWith("/import"))!.body).toEqual({ days: [
      { day: "2026-11-01", water_ml: 750, activity: "Walk", active_minutes: 20, burn_kcal: 120 },
      { day: "2026-11-02", energy: "low", sore: "bit" }] });
    await waitFor(() => expect(localStorage.getItem("trackcal:account:member:trackcal:wellness:2026-11-01")).toBeNull());
    expect(localStorage.getItem("trackcal:account:member:trackcal:studio:checkins")).toBeNull();
  });

  it("check-ins come from the account's days", async () => {
    server = { ...server, energy: "great", sore: "no" };
    render(<Feel />);
    await waitFor(() => expect(screen.getByTestId("feel").textContent).toBe(`${DATE}:great`));
  });

  it("signed out, it is this browser's values as before", () => {
    account.id = "";
    render(<Water id="a" />);
    act(() => setWater!(w => ({ ...w, water: w.water + 250 }) as never));
    expect(screen.getByTestId("a").textContent).toBe("250/2000");
    expect(calls).toHaveLength(0);
  });
});
