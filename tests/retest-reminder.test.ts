import { describe, expect, it } from "vitest";
import { retestDue } from "@/components/retest-reminder";
import type { Summary } from "@/lib/health";

const summary = (retest_on: string): Summary => ({ reports: [], history: {}, latest: {
  report: { id: "r", report_date: "2026-08-01", lab_name: null, source: "manual" }, safety: "ok", safety_message: "", disclaimer: "",
  findings: [{ code: "hba1c", name: "HbA1c", value: 6.8, unit: "%", low: null, high: 5.6, range_from: "standard adult range", status: "high", severity: "watch", rule: "sugar", explanation: "" },
             { code: "hdl", name: "HDL cholesterol", value: 55, unit: "mg/dL", low: 50, high: null, range_from: "standard adult range", status: "normal", severity: "ok", rule: null, explanation: "" }],
  plan: { rules: ["sugar"], targets: {}, exercise: {}, diet: [], move: [], retest_days: 90, retest_on, why: [{ rule: "sugar", about: "Blood sugar", source: "ADA Standards of Care in Diabetes 2025", retest_days: 90 }] } } });

describe("retest reminder", () => {
  const today = new Date("2026-11-13T10:00:00");
  it("stays quiet while the retest is more than three weeks away", () => expect(retestDue(summary("2026-12-20"), today)).toBeNull());
  it("names the results to recheck when the date is close", () => {
    const due = retestDue(summary("2026-11-20"), today)!;
    expect(due.days).toBe(7); expect(due.tests).toEqual(["HbA1c"]); expect(due.why[0].source).toMatch(/ADA/);
  });
  it("keeps reminding once overdue", () => expect(retestDue(summary("2026-11-01"), today)!.days).toBe(-12));
  it("shows nothing without a report", () => expect(retestDue({ reports: [], latest: null, history: {} }, today)).toBeNull());
});
