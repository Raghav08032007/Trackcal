// Exercise safety: an exercise the app advises against is explained before it starts, safer ones are offered, and going ahead
// needs a second, explicit acceptance of responsibility that is recorded on the account.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const account = vi.hoisted(() => ({ id: "member" }));
vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: account.id ? { id: account.id } : null }), useWorkspaceScope: () => account.id || "guest" }));
import { resetSafety, useExerciseSafety } from "@/lib/exercise-safety";
import { SafetyGate } from "@/components/safety-gate";
import { dailyPackage, MUSCLE_CATEGORIES } from "@/lib/muscle-finder";
import type { ExerciseKind } from "@/lib/pose/types";

const SAFETY = { exercises: { camera_squat: { level: "avoid", reasons: ["This works your knee, which needs to rest after your surgery in the last 6 weeks."] }, camera_plank: { level: "caution", reasons: ["This uses your shoulder a little while it heals."] } }, protected: { knee: "avoid" }, report_limit: null };
let posts: unknown[] = [];

function Probe({ kind, onResult }: { kind: ExerciseKind; onResult: (r: ReturnType<typeof useExerciseSafety>) => void }) { onResult(useExerciseSafety()); return <p>{kind}</p>; }

describe("exercise safety", () => {
  beforeEach(() => {
    resetSafety(); posts = []; account.id = "member";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/exercise-ack")) { posts.push(JSON.parse(String(init!.body))); return Response.json({ status: "recorded", level: "avoid" }); }
      return Response.json(SAFETY);
    }));
  });

  it("knows what is advised against and offers safer exercises from the same body area", async () => {
    let got: ReturnType<typeof useExerciseSafety> | null = null;
    render(<Probe kind="squat" onResult={r => { got = r; }} />);
    await waitFor(() => expect(got!.adviceFor("squat")?.level).toBe("avoid"));
    expect(got!.adviceFor("curl")).toBeNull();
    const safer = got!.saferThan("squat");
    expect(safer.length).toBeGreaterThan(0);
    expect(safer).not.toContain("squat");
  });

  it("signed out, nothing is advised (nothing is known)", async () => {
    account.id = ""; let got: ReturnType<typeof useExerciseSafety> | null = null;
    render(<Probe kind="squat" onResult={r => { got = r; }} />);
    expect(got!.adviceFor("squat")).toBeNull();
  });

  it("explains why, offers safer choices, and needs an explicit acceptance before continuing", async () => {
    const onContinue = vi.fn(), onSafer = vi.fn();
    render(<SafetyGate title="Squats" template="camera_squat" advice={SAFETY.exercises.camera_squat as never} safer={[{ id: "wallpush", title: "Wall push-ups" }, { id: "bridge", title: "Glute bridges" }]} onSafer={onSafer} onContinue={onContinue} onClose={() => {}} />);
    expect(screen.getByRole("alertdialog", { name: /Squats: not suitable for you right now/ })).toBeTruthy();
    expect(screen.getByText(/needs to rest after your surgery/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Glute bridges" }));
    expect(onSafer).toHaveBeenCalledWith("bridge");
    fireEvent.click(screen.getByRole("button", { name: /I still want to do squats/ }));
    expect(screen.getByRole("heading", { name: "This is your decision" })).toBeTruthy();
    expect(screen.getByText(/you are responsible for any consequences/)).toBeTruthy();
    const go = screen.getByRole("button", { name: "Continue anyway" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/I understand and accept the responsibility/));
    fireEvent.click(go);
    await waitFor(() => expect(onContinue).toHaveBeenCalled());
    expect(posts).toEqual([{ template: "camera_squat", accepted: true }]);
  });

  it("ready-made plans leave out what the app advises against", () => {
    const legs = MUSCLE_CATEGORIES.find(c => c.id === "legs")!;
    const plan = dailyPackage(legs, { equipment: "any", level: "any" }, "seed", 6, () => 10, k => k === "squat" || k === "lunge");
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.map(s => s.kind)).not.toContain("squat");
    expect(plan.map(s => s.kind)).not.toContain("lunge");
  });
});
