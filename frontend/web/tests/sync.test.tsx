// Account sync: changes are sent a moment after they are made, two devices merge instead of overwriting,
// changes wait while offline, and settings only in this browser are sent the first time.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
const account = vi.hoisted(() => ({ id: "member" }));
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: { id: account.id } }), useWorkspaceScope: () => account.id }));
import { merge, resetSync, startSync, syncNow, useSyncStatus } from "@/lib/sync";
import { useLocalState } from "@/lib/use-local-state";

type Entry = { value: unknown; version: number };
let server: Record<string, Entry> = {}, posts: { changes: { key: string; value?: unknown; base_version: number; removed?: boolean }[] }[] = [], offline = false;
const KEY = "trackcal:studio:pantry", LOCAL = `trackcal:account:member:${KEY}`;
let setPantry: ((f: (p: { id: string; name: string }[]) => { id: string; name: string }[]) => void) | null = null;

function Pantry() { const [p, set] = useLocalState<{ id: string; name: string; grams: number; expires: string }[]>(KEY, []); setPantry = set as never; return <p data-testid="pantry">{p.map(i => i.name).join(",")}</p>; }
function Status() { return <p data-testid="status">{useSyncStatus()}</p>; }
const item = (id: string, name: string) => ({ id, name, grams: 100, expires: "" });

describe("merging two copies", () => {
  it("keeps additions, edits and removals from both sides of a list", () => {
    const base = [item("a", "Rice"), item("b", "Dal"), item("c", "Oil")];
    const mine = [item("a", "Basmati rice"), item("c", "Oil"), item("d", "Ghee")];          // edited a, removed b, added d
    const theirs = [item("a", "Rice"), item("b", "Dal"), item("c", "Mustard oil"), item("e", "Salt")];  // edited c, added e
    expect(merge(base, mine, theirs)).toEqual([item("a", "Basmati rice"), item("c", "Mustard oil"), item("e", "Salt"), item("d", "Ghee")]);
  });
  it("a removal here does not delete something the other device changed", () => {
    expect(merge([item("a", "Rice")], [], [item("a", "Brown rice")])).toEqual([item("a", "Brown rice")]);
  });
  it("shopping items are matched by name", () => {
    const merged = merge([], [{ name: "Milk", checked: false }], [{ name: "Eggs", checked: true }]);
    expect(merged).toEqual([{ name: "Eggs", checked: true }, { name: "Milk", checked: false }]);
  });
  it("a single setting changed on both: the latest change wins; unchanged here: the account's wins", () => {
    expect(merge("light", "dark", "system")).toBe("dark");
    expect(merge("light", "light", "system")).toBe("system");
  });
});

describe("syncing with the account", () => {
  let stop: (() => void) | null = null;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetSync(); localStorage.clear(); server = {}; posts = []; offline = false;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (offline) throw new TypeError("Failed to fetch");
      if (!init?.body) return Response.json({ entries: server });
      const body = JSON.parse(String(init.body)); posts.push(body);
      const saved: Record<string, number> = {}, conflicts: Record<string, Entry | null> = {};
      for (const c of body.changes) {
        const cur = server[c.key]?.version ?? 0;
        if (c.base_version !== cur) { conflicts[c.key] = server[c.key] ?? null; continue; }
        server[c.key] = { value: c.removed ? null : c.value, version: cur + 1 }; saved[c.key] = cur + 1;
      }
      return Response.json({ saved, conflicts, refused: {} });
    }));
  });
  afterEach(() => { stop?.(); stop = null; vi.useRealTimers(); });

  it("a change is saved to the account a moment after it is made", async () => {
    render(<><Pantry /><Status /></>);
    stop = startSync("member");
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("saved"));
    act(() => setPantry!(p => [...p, item("a", "Rice")]));
    expect(screen.getByTestId("status").textContent).toBe("saving");
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    await waitFor(() => expect(server[KEY]).toEqual({ value: [item("a", "Rice")], version: 1 }));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("saved"));
  });

  it("when another device saved first, both changes are kept", async () => {
    server[KEY] = { value: [item("a", "Rice")], version: 1 };
    render(<Pantry />);
    stop = startSync("member");
    await waitFor(() => expect(screen.getByTestId("pantry").textContent).toBe("Rice"));     // the account's copy arrives
    server[KEY] = { value: [item("a", "Rice"), item("b", "Dal")], version: 2 };              // the other phone adds Dal
    act(() => setPantry!(p => [...p, item("c", "Ghee")]));                                   // this one adds Ghee
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    await waitFor(() => expect(server[KEY].value).toEqual([item("a", "Rice"), item("b", "Dal"), item("c", "Ghee")]));
    expect(server[KEY].version).toBe(3);
    expect(screen.getByTestId("pantry").textContent).toBe("Rice,Dal,Ghee");
  });

  it("offline changes wait, and are sent when back online", async () => {
    render(<><Pantry /><Status /></>);
    stop = startSync("member");
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("saved"));
    offline = true;
    act(() => setPantry!(p => [...p, item("a", "Rice")]));
    await act(async () => { await vi.advanceTimersByTimeAsync(900); });
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("offline"));
    expect(JSON.parse(localStorage.getItem("trackcal-sync:member")!).dirty).toEqual([KEY]);
    offline = false;
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(server[KEY]?.value).toEqual([item("a", "Rice")]));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("saved"));
  });

  it("settings that were only in this browser are sent the first time; diary and drafts are not", async () => {
    localStorage.setItem("trackcal:account:member:trackcal:appearance", JSON.stringify("dark"));
    localStorage.setItem("trackcal:account:member:trackcal:camera:draft", JSON.stringify({ x: 1 }));
    localStorage.setItem(LOCAL, JSON.stringify([item("a", "Rice")]));
    stop = startSync("member");
    await waitFor(() => expect(Object.keys(server).sort()).toEqual(["trackcal:appearance", KEY]));
    await syncNow();
    expect(posts.flatMap(p => p.changes.map(c => c.key))).not.toContain("trackcal:camera:draft");
  });

  it("an account copy replaces an untouched setting here", async () => {
    server["trackcal:appearance"] = { value: "dark", version: 4 };
    stop = startSync("member");
    await waitFor(() => expect(localStorage.getItem("trackcal:account:member:trackcal:appearance")).toBe(JSON.stringify("dark")));
    expect(posts).toHaveLength(0);
  });
});
