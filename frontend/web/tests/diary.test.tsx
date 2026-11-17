// One food diary for every screen: server-backed when signed in, shared between screens, moved over from the browser once.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
const account = vi.hoisted(() => ({ id: "" }));
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: account.id ? { id: account.id } : null }), useWorkspaceScope: () => account.id || "guest" }));
import { resetDiaryStore, useDiaryMeals, type DiaryMeal } from "@/lib/diary";

const DAY = "2026-11-08";
const entry = (id: string, name: string, calories: number, method = "manual") => ({ id, day: DAY, time: "08:30", meal_type: "breakfast", method, notes: "", items: [{ name, grams: 100, nutrients: { calories, protein: 5, carbs: 30, fat: 2 } }], totals: { calories, protein: 5, carbs: 30, fat: 2 } });
let server: ReturnType<typeof entry>[] = [], calls: { method: string; url: string; body?: Record<string, unknown> }[] = [], failNext = false;

function fake() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? (init?.body ? "POST" : "GET"), body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (failNext && method !== "GET") { failNext = false; return Response.json({ error: "Diary is busy." }, { status: 503 }); }
    if (url.startsWith("/api/wellness/diary?")) return Response.json({ entries: server, has_more: false });
    const restore = /diary\/([^/]+)\/restore$/.exec(url), one = /diary\/([^/?]+)$/.exec(url);
    if (restore) { const gone = deleted.get(restore[1])!; server.push(gone); return Response.json({ entry: gone }); }
    if (method === "POST" && url.endsWith("/api/wellness/diary")) { const t = body!.items as { name: string; grams: number; nutrients: { calories: number } }[]; const e = entry(String(body!.id), t[0].name, Math.round(t[0].nutrients.calories * t[0].grams / 100)); server.push(e); return Response.json({ entry: e }); }
    if (method === "DELETE" && one) { const i = server.findIndex(e => e.id === one[1]); deleted.set(one[1], server[i]); server.splice(i, 1); return Response.json({ status: "removed" }); }
    if (method === "PUT" && one) return Response.json({ entry: server.find(e => e.id === one[1]) });
    return Response.json({});
  }));
}
const deleted = new Map<string, ReturnType<typeof entry>>();
let api: { meals: DiaryMeal[]; set: (n: DiaryMeal[] | ((p: DiaryMeal[]) => DiaryMeal[])) => void; error: string } | null = null;
function Probe({ id }: { id: string }) { const [meals, set, state] = useDiaryMeals(DAY); if (id === "a") api = { meals, set, error: state.error }; return <p data-testid={id}>{meals.map(m => `${m.name}:${m.calories}`).join("|")}</p>; }

describe("one food diary", () => {
  beforeEach(() => { resetDiaryStore(); localStorage.clear(); server = []; calls = []; deleted.clear(); failNext = false; account.id = "member"; fake(); });

  it("loads the day from the server, and every screen shows the same meals", async () => {
    server = [entry("11111111-1111-4111-8111-111111111111", "Idli", 240)];
    render(<><Probe id="a" /><Probe id="b" /></>);
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("Idli:240"));
    expect(screen.getByTestId("b").textContent).toBe("Idli:240");
    expect(calls.filter(c => c.url.startsWith("/api/wellness/diary?")).length).toBe(1);   // one request shared by both screens
  });

  it("adds a meal with its real items, deletes it, and undo restores the same entry", async () => {
    render(<><Probe id="a" /><Probe id="b" /></>);
    await waitFor(() => expect(api).not.toBeNull());
    act(() => api!.set(prev => [...prev, { time: "13:05", name: "Dosa", calories: 168, protein: 4, carbs: 28, fat: 4, method: "Photo scan", items: [{ name: "Dosa", grams: 120, nutrients: { calories: 140, protein: 3.3, carbs: 23.3, fat: 3.3 } }] }]));
    await waitFor(() => expect(screen.getByTestId("b").textContent).toBe("Dosa:168"));
    const post = calls.find(c => c.method === "POST")!;
    expect(post.body!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(post.body).toMatchObject({ day: DAY, method: "photo", meal_type: "lunch", items: [{ name: "Dosa", grams: 120 }] });
    const added = api!.meals[0];
    act(() => api!.set(prev => prev.filter(m => m.id !== added.id)));
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe(""));
    expect(calls.some(c => c.method === "DELETE" && c.url.endsWith(added.id!))).toBe(true);
    act(() => api!.set(prev => [...prev, added]));                                   // undo
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("Dosa:168"));
    expect(calls.some(c => c.url.endsWith(`${added.id}/restore`))).toBe(true);
  });

  it("puts everything back and says so when the server refuses a change", async () => {
    server = [entry("11111111-1111-4111-8111-111111111111", "Idli", 240)];
    render(<Probe id="a" />);
    await waitFor(() => expect(api?.meals.length).toBe(1));
    failNext = true;
    act(() => api!.set([]));
    await waitFor(() => expect(api!.error).toMatch(/Nothing was changed/));
    expect(screen.getByTestId("a").textContent).toBe("Idli:240");
  });

  it("moves meals that were only in this browser to the account once, and never twice", async () => {
    localStorage.setItem(`trackcal:account:member:trackcal:journal:${new Date().toISOString().slice(0, 10)}`, JSON.stringify([{ name: "Poha", time: "09:00", method: "Manual", calories: 250, protein: 6, carbs: 45, fat: 5 }]));
    render(<Probe id="a" />);
    await waitFor(() => expect(calls.filter(c => c.method === "POST")).toHaveLength(1));
    const moved = calls.find(c => c.method === "POST")!.body!;
    expect(moved).toMatchObject({ method: "copied", items: [{ name: "Poha", grams: 100 }] });
    expect(Object.keys(localStorage).some(k => k.includes("trackcal:journal:"))).toBe(false);   // the browser copy is gone
    resetDiaryStore(); calls = [];
    render(<Probe id="a" />);
    await waitFor(() => expect(calls.some(c => c.method === "GET")).toBe(true));
    expect(calls.filter(c => c.method === "POST")).toHaveLength(0);
  });

  it("signed out, it is the browser journal as before", async () => {
    account.id = "";
    render(<Probe id="a" />);
    act(() => api!.set([{ time: "10:00", name: "Banana", calories: 105, protein: 1, carbs: 27, fat: 0, method: "Manual" }]));
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("Banana:105"));
    expect(calls).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem(`trackcal:journal:${DAY}`)!)[0].name).toBe("Banana");
  });
});
