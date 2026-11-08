// My health report: the three ways in, checking values before saving, the plan, and the safety stop.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ user: { id: "u1" }, ready: true }) }));

const tests = { tests: [{ code: "hba1c", name: "HbA1c", unit: "%" }, { code: "glucose_fasting", name: "Fasting glucose", unit: "mg/dL" }] };
const empty = { reports: [], latest: null, history: {} };
const plan = { rules: ["sugar"], targets: { fibre_g: 30, added_sugar_g: 25 }, exercise: { post_meal_walk: true, strength_days: 3, cardio_min: 150 }, diet: ["Swap white rice for millets."], move: ["Walk after meals."], retest_days: 90, retest_on: "2027-02-06" };
const finding = { code: "hba1c", name: "HbA1c", value: 6.4, unit: "%", low: 4, high: 5.6, range_from: "your lab", status: "high", severity: "watch", rule: "sugar", explanation: "Your average blood sugar is above normal." };

describe("my health report", () => {
  it("offers PDF, photo (with consent) and typing, then checks values before saving and shows the plan", async () => {
    let saved: { results: { code: string; value: number }[] } | null = null;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/tests")) return Response.json(tests);
      if (url.endsWith("/reports") && init?.method === "POST") { saved = JSON.parse(String(init.body)); return Response.json({}, { status: 201 }); }
      if (url.endsWith("/summary")) return Response.json(saved ? { reports: [{ id: "r1", report_date: "2026-11-08", lab_name: null, source: "manual", tests: 1 }], latest: { report: { id: "r1", report_date: "2026-11-08", lab_name: null, source: "manual" }, findings: [finding], safety: "ok", safety_message: "", plan, disclaimer: "Not a diagnosis." }, history: { hba1c: [{ date: "2026-11-08", value: 6.4 }] } } : empty);
      return Response.json({});
    }));
    const { default: Page } = await import("@/app/health/page");
    render(<Page />);
    expect(await screen.findByRole("heading", { name: "Upload the PDF" })).toBeTruthy();
    expect((screen.getByLabelText("Choose photo") as HTMLInputElement).disabled).toBe(true);   // no AI without consent
    fireEvent.click(screen.getByRole("button", { name: /Type the values/ }));
    await waitFor(() => expect(screen.getByLabelText("Add a test")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Add a test"), { target: { value: "hba1c" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    const confirm = screen.getByRole("button", { name: "Confirm & see my plan" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);                                                     // a value must be entered first
    fireEvent.change(screen.getByLabelText("HbA1c value"), { target: { value: "6.4" } });
    fireEvent.click(confirm);
    expect(await screen.findByRole("heading", { name: "Your plan from this report" })).toBeTruthy();
    expect(saved!.results).toEqual([{ code: "hba1c", value: 6.4, ref_low: null, ref_high: null }]);
    expect(screen.getByText("30 g fibre a day")).toBeTruthy();
    expect(screen.getByText("A 10-15 minute walk after lunch and dinner")).toBeTruthy();
  });
  it("stops at a doctor today when a value is dangerous", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/tests") ? Response.json(tests) : Response.json({ reports: [{ id: "r1", report_date: "2026-11-08", lab_name: null, source: "manual", tests: 1 }], latest: { report: { id: "r1", report_date: "2026-11-08", lab_name: null, source: "manual" }, findings: [{ ...finding, code: "glucose_fasting", name: "Fasting glucose", value: 340, severity: "today" }], safety: "today", safety_message: "One or more results need a doctor today.", plan: null, disclaimer: "x" }, history: {} })));
    const { default: Page } = await import("@/app/health/page");
    render(<Page />);
    expect((await screen.findByRole("alert")).textContent).toContain("See a doctor today");
    expect(screen.queryByRole("heading", { name: "Your plan from this report" })).toBeNull();
  });
});
