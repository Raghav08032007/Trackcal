// "+" quick add: opens from the tab bar or with N (not while typing), saves water with undo, sleep and how you feel,
// and food, workout and route choices lead to the right pages.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
const account = vi.hoisted(() => ({ id: "" }));
const route = vi.hoisted(() => ({ path: "/food" }));
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: account.id ? { id: account.id } : null }), useWorkspaceScope: () => account.id || "guest" }));
vi.mock("@/lib/navigation", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/navigation")>()), usePathname: () => route.path }));
import { QuickAdd } from "@/components/quick-add";
import { resetDays } from "@/lib/days";
import { localDate } from "@/lib/use-local-state";

type Call = { method: string; url: string; body?: Record<string, unknown> };
let calls: Call[] = [];

describe("quick add", () => {
  beforeEach(() => {
    resetDays(); localStorage.clear(); calls = []; account.id = ""; route.path = "/food";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET", body = init?.body ? JSON.parse(String(init.body)) : undefined; calls.push({ method, url, body });
      const day = { day: localDate(), water_ml: 0, water_goal_ml: 2400, water_goal_set: false, steps: 0, active_minutes: 0, activity: "", burn_kcal: 0, route_kcal: 0, burned_total: 0,
        weight_kg: null, sleep_hours: null, sleep_quality: null, energy: null, sore: null, saved: false };
      if (url.endsWith("/days")) return Response.json({ today: day.day, days: [day] });
      return Response.json(day);
    }));
  });

  it("opens from the button and with N, but not while typing", () => {
    render(<><input aria-label="Notes" /><QuickAdd /></>);
    expect(screen.queryByRole("heading", { name: "Quick add" })).toBeNull();
    fireEvent.keyDown(screen.getByLabelText("Notes"), { key: "n" });
    expect(screen.queryByRole("heading", { name: "Quick add" })).toBeNull();
    fireEvent.keyDown(window, { key: "n" });
    expect(screen.getByRole("heading", { name: "Quick add" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("heading", { name: "Quick add" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: "Add" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("food, workout and route lead to the right pages", () => {
    render(<QuickAdd />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(["Photo", "Barcode", "Describe", "Search", "Start a workout", "Record a route"].map(n => screen.getByRole("link", { name: n }).getAttribute("href")))
      .toEqual(["/scanner", "/barcode", "/describe", "/food-library", "/workouts/camera", "/workouts/gps"]);
  });

  it("signed out, water saves in this browser and can be undone; sleep needs an account", () => {
    render(<QuickAdd />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.queryByRole("heading", { name: /Sleep/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "+ 250 ml" }));
    expect(screen.getByRole("status").textContent).toContain("0.25 L today");
    expect(JSON.parse(localStorage.getItem(`trackcal:wellness:${localDate()}`)!).water).toBe(250);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(JSON.parse(localStorage.getItem(`trackcal:wellness:${localDate()}`)!).water).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("signed in, water, sleep and how you feel save to the account", async () => {
    account.id = "member";
    render(<QuickAdd />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.getByText("0 of 2.4 L")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "+ 250 ml" }));
    await waitFor(() => expect(calls.some(c => c.method === "POST" && JSON.stringify(c.body) === JSON.stringify({ set: {}, add: { water_ml: 250 } }))).toBe(true));
    fireEvent.change(screen.getByLabelText("Hours slept"), { target: { value: "7.4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.some(c => c.method === "POST" && (c.body?.set as Record<string, unknown>)?.sleep_hours === 7.5)).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Great" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "A bit sore" })); });
    await waitFor(() => expect(calls.some(c => c.method === "POST" && JSON.stringify((c.body?.set as Record<string, unknown>)) === JSON.stringify({ energy: "great", sore: "bit" }))).toBe(true));
    expect(screen.getByRole("status").textContent).toContain("Your coach will use this today");
  });

  it("closes when a link inside is followed", () => {
    const { rerender } = render(<QuickAdd />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    route.path = "/scanner"; rerender(<QuickAdd />);
    expect(screen.queryByRole("heading", { name: "Quick add" })).toBeNull();
  });
});
