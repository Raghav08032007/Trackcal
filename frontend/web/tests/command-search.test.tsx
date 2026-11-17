// Search everything: pages by name and everyday words, quick actions, foods from the catalogue and your workouts;
// opens with Ctrl+K and "/", works with arrow keys and Enter, remembers recent searches.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
const account = vi.hoisted(() => ({ id: "" }));
const nav = vi.hoisted(() => ({ path: "/food", push: vi.fn() }));
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: account.id ? { id: account.id } : null }), useWorkspaceScope: () => account.id || "guest" }));
vi.mock("@/lib/navigation", async importOriginal => ({ ...(await importOriginal<typeof import("@/lib/navigation")>()), usePathname: () => nav.path, useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn() }) }));
import { CommandSearch } from "@/components/command-search";
import { score, searchLocal } from "@/lib/search";
import { resetDays } from "@/lib/days";
import { localDate } from "@/lib/use-local-state";

describe("finding pages", () => {
  it("by name and by everyday words", () => {
    const first = (q: string) => searchLocal(q)[0]?.href ?? searchLocal(q)[0]?.action;
    expect(first("barcode")).toBe("/barcode");
    expect(first("pantry")).toBe("/tools?tab=pantry");
    expect(first("blood test")).toBe("/health");
    expect(first("weight")).not.toBeUndefined();
    expect(searchLocal("weight").some(h => h.href === "/progress")).toBe(true);
    expect(first("run")).toBe("/workouts/gps");
    expect(first("water")).toBe("water");
    expect(searchLocal("zzqx")).toEqual([]);
  });
  it("every typed word must match something", () => {
    expect(score("record route", "Record a route")).toBeGreaterThan(0);
    expect(score("record zebra", "Record a route")).toBe(0);
    expect(score("Récord", "Record a route")).toBeGreaterThan(0);          // accents don't matter
  });
});

describe("the search panel", () => {
  beforeEach(() => {
    resetDays(); localStorage.clear(); account.id = ""; nav.path = "/food"; nav.push.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/foods")) return Response.json({ results: [{ id: "1", name: "Masoor dal", calories: 116, serving_size: "100 g" }] });
      if (url.includes("/history")) return Response.json({ items: [{ id: "w1", kind: "route", title: "Morning run", at: "", day: "2026-11-08", minutes: 30, detail: "5.20 km", removable: false, editable: false, link: "/activity?id=w1" }], has_more: false });
      return Response.json({});
    }));
  });

  it("opens with Ctrl+K and with /, but not while typing", () => {
    render(<><input aria-label="Notes" /><CommandSearch /></>);
    fireEvent.keyDown(screen.getByLabelText("Notes"), { key: "/" });
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("combobox", { name: "Search TrackCal" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    fireEvent.keyDown(window, { key: "/" });
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("shows quick actions before typing; arrow keys and Enter open a page and remember the search", async () => {
    render(<CommandSearch />);
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(screen.getByRole("option", { name: /Add 250 ml water/ })).toBeTruthy();
    const box = screen.getByRole("combobox");
    fireEvent.change(box, { target: { value: "barcode" } });
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(nav.push).toHaveBeenCalledWith("/barcode");
    expect(JSON.parse(localStorage.getItem("trackcal-search-recent")!)).toEqual(["barcode"]);
  });

  it("finds foods from the catalogue, opening food search with the name", async () => {
    render(<CommandSearch />);
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "masoor" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    const food = await screen.findByRole("option", { name: /Masoor dal/ });
    fireEvent.click(food);
    expect(nav.push).toHaveBeenCalledWith("/food-library?q=Masoor%20dal");
  });

  it("signed in, finds your workouts and opens the right page", async () => {
    account.id = "member";
    render(<CommandSearch />);
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "morning" } });
    const run = await screen.findByRole("option", { name: /Morning run/ });
    fireEvent.click(run);
    expect(nav.push).toHaveBeenCalledWith("/activity?id=w1");
  });

  it("signed out, Add water saves in this browser", () => {
    render(<CommandSearch />);
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    fireEvent.click(screen.getByRole("option", { name: /Add 250 ml water/ }));
    expect(screen.getByRole("status").textContent).toBe("Added 250 ml water to today.");
    expect(JSON.parse(localStorage.getItem(`trackcal:wellness:${localDate()}`)!).water).toBe(250);
  });

  it("says when nothing matches", async () => {
    render(<CommandSearch />);
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzqx" } });
    await waitFor(() => expect(screen.getByText(/Nothing found for "zzqx"/)).toBeTruthy());
  });
});

describe("foods and pages together", () => {
  it("a word that names a page doesn't bring up foods that only match a regional name", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ results: [{ id: "9", name: "Jowar", calories: 334 }, { id: "8", name: "Runner beans", calories: 25 }] })));
    render(<CommandSearch />);
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "run" } });
    await screen.findByRole("option", { name: /Runner beans/ });
    expect(screen.queryByRole("option", { name: /Jowar/ })).toBeNull();
    expect(screen.getByRole("option", { name: /Record a route/ })).toBeTruthy();
  });
  it("a regional name that names no page still finds its food", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ results: [{ id: "7", name: "Rice, cooked", calories: 130 }] })));
    render(<CommandSearch />);
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "chawal" } });
    expect(await screen.findByRole("option", { name: /Rice, cooked/ })).toBeTruthy();
  });
});
