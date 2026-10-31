import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { it, expect, vi } from "vitest";
const session = vi.hoisted(() => ({ user: { id: "u1" }, ready: true }));
vi.mock("../src/components/account-session", () => ({ useAccount: () => session, useWorkspaceScope: () => "u1" }));
import Challenges from "../src/app/challenges/page";
import ChallengePage from "../src/app/challenge/page";
import type { ChallengeView } from "../src/lib/challenges";

const base: ChallengeView = { hidden: false, id: "22222222-2222-2222-2222-222222222222", title: "Five active days", description: "", metric: "active_days", metric_label: "Active days (a workout, a logged meal or an event)", target: 5, starts_on: "2026-10-30", ends_on: "2026-11-05", timezone: "Asia/Kolkata", phase: "running", participants: 4, finished: 1, creator: { handle: "ravi", display_name: "Ravi" }, community: null, mine: null, created_by_me: false };
let calls: { url: string; method: string; body: unknown }[] = [];
function api(routes: (url: string, method: string) => unknown) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, o?: RequestInit) => { const method = o?.method || "GET"; calls.push({ url, method, body: o?.body ? JSON.parse(o.body as string) : undefined }); return Response.json(routes(url, method)); }));
}
const at = (path: string) => render(<RouterProvider router={createMemoryRouter([{ path: "/challenges/:id", element: <ChallengePage /> }], { initialEntries: [path] })} />);

it("lists challenges with progress and no ranking, and starts one in the browser's time zone", async () => {
  api((url, method) => url.endsWith("/api/social/me") ? { profile: { handle: "me" } } : method === "POST" ? { challenge: base } : { challenges: [{ ...base, mine: { progress: 2, completed: false } }] });
  render(<Challenges />);
  expect(await screen.findByRole("heading", { name: "Five active days" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Your progress: 2 of 5" })).toBeTruthy();
  expect(screen.queryByText(/#\d|\b(1st|2nd|3rd)\b/)).toBeNull();  // no positions shown
  fireEvent.click(screen.getByRole("button", { name: "Start a challenge" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Walk week" } });
  fireEvent.change(screen.getByLabelText(/^What counts/), { target: { value: "workouts" } });
  expect(screen.getByText("completed, 10+ minutes, up to 2 a day")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start challenge" }));
  await waitFor(() => expect(calls.some(c => c.method === "POST")).toBe(true));
  const sent = calls.find(c => c.method === "POST")!.body as Record<string, unknown>;
  expect(sent).toMatchObject({ title: "Walk week", metric: "workouts", target: 5 });
  expect(Object.keys(sent)).not.toContain("progress");
});

it("joins, and celebrates when the server says the challenge is complete", async () => {
  api((_url, method) => method === "POST" ? { challenge: { ...base, mine: { progress: 0, completed: false } } } : { challenge: base, awarded_xp: 0 });
  at(`/challenges/${base.id}`);
  fireEvent.click(await screen.findByRole("button", { name: "Join challenge" }));
  expect(await screen.findByRole("img", { name: "Your progress: 0 of 5" })).toBeTruthy();
});

it("shows completion and XP from the server", async () => {
  api(() => ({ challenge: { ...base, mine: { progress: 5, completed: true } }, awarded_xp: 40 }));
  at(`/challenges/${base.id}`);
  expect(await screen.findByText("Challenge complete! +40 XP")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Your progress: 5 of 5, complete" })).toBeTruthy();
});
