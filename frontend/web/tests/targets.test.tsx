// Daily targets: one set from the account, saved as manual values when changed, custom browser values moved once.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
const account = vi.hoisted(() => ({ id: "" }));
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: account.id ? { id: account.id } : null }), useWorkspaceScope: () => account.id || "guest" }));
import { resetTargets, useTarget } from "@/lib/targets";

const server = (calories: number, manual: string[] = [], complete = true) => ({ calories, protein: 109, carbs: 142, fat: 44, fibre: 20, added_sugar_max: 35, complete, manual, explanation: ["x"], basis: {} });
let calls: { method: string; body?: Record<string, unknown> }[] = [], state = server(1400);
let setter: ((n: number) => void) | null = null;
function Probe({ id }: { id: string }) { const [calories, set] = useTarget("calories"); if (id === "a") setter = set; return <p data-testid={id}>{calories}</p>; }

describe("daily targets", () => {
  beforeEach(() => {
    resetTargets(); localStorage.clear(); calls = []; state = server(1400); account.id = "member";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET", body = init?.body ? JSON.parse(String(init.body)) : undefined; calls.push({ method, body });
      if (method === "PUT") state = server(body.calories ?? 1400, body.calories ? ["calories"] : [], state.complete);
      return Response.json(state);
    }));
  });
  it("every screen shows the account's calculated target", async () => {
    render(<><Probe id="a" /><Probe id="b" /></>);
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("1400"));
    expect(screen.getByTestId("b").textContent).toBe("1400");
    expect(calls.filter(c => c.method === "GET")).toHaveLength(1);
  });
  it("changing it saves a manual value for every screen", async () => {
    render(<><Probe id="a" /><Probe id="b" /></>);
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("1400"));
    act(() => setter!(1650));
    await waitFor(() => expect(screen.getByTestId("b").textContent).toBe("1650"));
    expect(calls.find(c => c.method === "PUT")!.body).toEqual({ calories: 1650 });
  });
  it("a custom value that was only in this browser becomes the manual target once, when the profile can't calculate yet", async () => {
    state = server(2000, [], false);
    localStorage.setItem("trackcal:account:member:trackcal:target:calories", "1800");
    render(<Probe id="a" />);
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("1800"));
    expect(calls.find(c => c.method === "PUT")!.body).toEqual({ calories: 1800 });
    expect(localStorage.getItem("trackcal:account:member:trackcal:target:calories")).toBeNull();
  });
  it("a calculated profile wins over an old browser value", async () => {
    localStorage.setItem("trackcal:account:member:trackcal:target:calories", "1800");
    render(<Probe id="a" />);
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("1400"));
    expect(calls.some(c => c.method === "PUT")).toBe(false);
  });
  it("signed out, it is this browser's value as before", () => {
    account.id = "";
    render(<Probe id="a" />);
    expect(screen.getByTestId("a").textContent).toBe("2100");
    act(() => setter!(1900));
    expect(screen.getByTestId("a").textContent).toBe("1900");
    expect(calls).toHaveLength(0);
  });
});
