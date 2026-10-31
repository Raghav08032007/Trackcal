import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { mealForHour, QuickLog } from "@/components/quick-log";
import { emptyItem } from "@/lib/wellness";

const account = vi.hoisted(() => ({ user: { id: "member" } as { id: string } | null }));
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: account.user }), useWorkspaceScope: () => account.user?.id || "guest" }));
const item = { ...emptyItem(), name: "Idli with sambar", grams: 250 };
const diary = { today: "2026-10-31", favorites: [{ id: "f1", food_key: "k1", item }, { id: "f2", food_key: "k2", item: { ...item, name: "Poha" } }, { id: "f3", food_key: "k3", item: { ...item, name: "Curd" } }, { id: "f4", food_key: "k4", item: { ...item, name: "Banana" } }] };
const server = (fail = false) => { const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => fail && init?.method === "POST" ? Response.json({ error: "Try again" }, { status: 503 }) : Response.json(init?.method && init.method !== "GET" ? { status: "ok" } : diary)); vi.stubGlobal("fetch", fetchMock); return fetchMock; };
const water = () => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key => key.includes("wellness")) || "") || "{}").water;

describe("quick log", () => {
  it("logs a favourite in one tap, and Undo removes it", async () => {
    account.user = { id: "member" }; const fetchMock = server(); render(<QuickLog date="2026-10-31" />);
    fireEvent.click(await screen.findByRole("button", { name: "Log Idli with sambar" }));
    expect((await screen.findByRole("status")).textContent).toContain("Logged Idli with sambar");
    const post = fetchMock.mock.calls.find(call => call[1]?.method === "POST");
    const body = JSON.parse(String(post?.[1]?.body)); expect(body).toMatchObject({ day: "2026-10-31", method: "saved" }); expect(body.items).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(call => call[1]?.method === "DELETE" && String(call[0]).endsWith(`/diary/${body.id}`))).toBe(true));
    expect(await screen.findByText("Undone")).toBeTruthy();
  });
  it("shows at most three favourites", async () => {
    account.user = { id: "member" }; server(); render(<QuickLog date="2026-10-31" />);
    await screen.findByRole("button", { name: "Log Curd" });
    expect(screen.queryByRole("button", { name: "Log Banana" })).toBeNull();
  });
  it("adds water in one tap and Undo takes it back, even signed out", async () => {
    account.user = null; const fetchMock = server(); render(<QuickLog date="2026-10-31" />);
    fireEvent.click(screen.getByRole("button", { name: "+250 ml water" }));
    expect(screen.getByRole("status").textContent).toContain("250 ml"); expect(water()).toBe(250);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(water()).toBe(0));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("says so when saving fails, and offers no Undo for something not saved", async () => {
    account.user = { id: "member" }; server(true); render(<QuickLog date="2026-10-31" />);
    fireEvent.click(await screen.findByRole("button", { name: "Log Poha" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Try again");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
  it("picks the meal from the time of day", () => {
    expect([8, 13, 19, 23].map(mealForHour)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });
});
