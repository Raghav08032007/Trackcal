// Workouts on the account: program days and circuits merge as changes, browser-only training data is copied once,
// and the history lists every kind with edit, delete and undo.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
const account = vi.hoisted(() => ({ id: "" }));
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: account.id ? { id: account.id } : null }), useWorkspaceScope: () => account.id || "guest" }));
import { resetWorkouts, useCircuits, useProgramDays, applyChange } from "@/lib/workouts";
import { WorkoutHistory } from "@/components/workout-history";
import { streakDays } from "@/lib/coach";

type Call = { method: string; url: string; body?: Record<string, unknown> };
let calls: Call[] = [], lib = { circuits: [] as unknown[], program_days: [] as string[], next_targets: [] as unknown[] };
let items: Record<string, unknown>[] = [];
let setDays: ((f: (d: string[]) => string[]) => void) | null = null;

function Days() { const [d, set] = useProgramDays(); setDays = set; return <p data-testid="days">{d.join(",")}</p>; }
function Circuits() { const [c] = useCircuits(); return <p data-testid="circuits">{c.length}</p>; }

const item = (id: string, kind: string, title: string, day = "2026-11-08") => ({ id, kind, title, at: day + "T10:00:00Z", day, minutes: 20, detail: "3 × 10", sets: 3, reps: 10, load: 0, removable: kind !== "route", editable: kind === "manual", ...(kind === "route" ? { link: "/activity?id=" + id } : {}) });

describe("workouts on the account", () => {
  beforeEach(() => {
    resetWorkouts(); localStorage.clear(); calls = []; account.id = "member";
    lib = { circuits: [], program_days: ["starter:0"], next_targets: [] };
    items = [item("a", "manual", "Leg day"), item("b", "camera", "Camera squats"), item("c", "route", "Morning run", "2026-11-07")];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET", body = init?.body ? JSON.parse(String(init.body)) : undefined; calls.push({ method, url, body });
      if (url.includes("library/import")) { lib = { ...lib, circuits: body.circuits, program_days: [...lib.program_days, ...body.program_days] }; return Response.json({ workouts: body.workouts.length, ...lib }); }
      if (url.endsWith("/library")) { if (method === "POST") lib = applyChange(lib as never, body) as never; return Response.json(lib); }
      if (url.includes("/history")) { const kind = new URL(url, "http://x").searchParams.get("kind"); return Response.json({ items: items.filter(i => kind === "all" || i.kind === kind), has_more: false, active_days: [] }); }
      if (method === "DELETE") { items = items.filter(i => !url.endsWith("/" + i.id)); return Response.json({ status: "removed" }); }
      if (url.endsWith("/restore")) { const back = item("a", "manual", "Leg day"); items = [back, ...items]; return Response.json(back); }
      if (method === "PUT") return Response.json({ ...item("a", "manual", body.name) });
      return Response.json({});
    }));
  });

  it("finishing a program day saves just that day, so another phone's days stay", async () => {
    render(<Days />);
    await waitFor(() => expect(screen.getByTestId("days").textContent).toBe("starter:0"));
    act(() => setDays!(d => [...d, "starter:1"]));
    expect(screen.getByTestId("days").textContent).toBe("starter:0,starter:1");
    await waitFor(() => expect(calls.find(c => c.method === "POST")!.body).toEqual({ program_days: { add: ["starter:1"], clear: [] } }));
    act(() => setDays!(d => d.filter(x => !x.startsWith("starter:"))));
    await waitFor(() => expect(calls.filter(c => c.method === "POST")[1].body).toEqual({ program_days: { add: [], clear: ["starter"] } }));
  });

  it("circuits and workouts that were only in this browser are copied once", async () => {
    localStorage.setItem("trackcal:account:member:trackcal:studio:circuits", JSON.stringify([{ id: "c1", name: "Legs", rest: 30, steps: [{ kind: "squat", target: 10 }] }]));
    localStorage.setItem("trackcal:account:member:trackcal:studio:workouts", JSON.stringify([{ id: "11111111-2222-3333-4444-555555555555", date: "2026-11-01", name: "Swim", minutes: 30, sets: 0, reps: 0, load: 0, source: "Manual entry" }]));
    render(<Circuits />);
    await waitFor(() => expect(screen.getByTestId("circuits").textContent).toBe("1"));
    const sent = calls.find(c => c.url.includes("library/import"))!.body!;
    expect((sent.workouts as { name: string; day: string }[])[0]).toMatchObject({ name: "Swim", day: "2026-11-01" });
    expect(localStorage.getItem("trackcal:account:member:trackcal:studio:circuits")).toBeNull();
  });

  it("the history shows every kind, filters, and undoes a delete", async () => {
    render(<WorkoutHistory />);
    await waitFor(() => expect(screen.getByText("Leg day")).toBeTruthy());
    expect(screen.getByText("Camera squats")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/activity?id=c");
    expect(screen.queryByRole("button", { name: "Delete Morning run" })).toBeNull();      // routes are deleted from their own page
    fireEvent.click(screen.getByRole("button", { name: "Routes" }));
    await waitFor(() => expect(screen.queryByText("Leg day")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(screen.getByText("Leg day")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Delete Leg day" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Leg day deleted"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(calls.some(c => c.url.endsWith("entries/a/restore"))).toBe(true));
    await waitFor(() => expect(screen.getByText("Leg day")).toBeTruthy());
  });

  it("a logged workout can be edited", async () => {
    render(<WorkoutHistory />);
    await waitFor(() => expect(screen.getByText("Leg day")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Edit Leg day" }));
    fireEvent.change(screen.getByLabelText("Workout"), { target: { value: "Pull day" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls.find(c => c.method === "PUT")!.body).toMatchObject({ name: "Pull day", day: "2026-11-08", minutes: 20 }));
  });

  it("streaks count days from the whole history", () => {
    const noon = (d: string) => Date.parse(d + "T12:00:00");
    expect(streakDays([], noon("2026-11-08"), ["2026-11-07", "2026-11-08", "2026-11-05"])).toBe(2);
  });

  it("signed out, program days stay in this browser", () => {
    account.id = "";
    render(<Days />);
    act(() => setDays!(d => [...d, "starter:0"]));
    expect(screen.getByTestId("days").textContent).toBe("starter:0");
    expect(calls).toHaveLength(0);
  });
});
