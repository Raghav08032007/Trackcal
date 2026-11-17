import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountSession, AccountUnavailable, useAccount } from "@/components/account-session";

function Page() { const { user, ready } = useAccount(); return <p>{!ready ? "loading" : user ? `member ${user.id}` : "Sign in"}</p>; }
const show = (path = "/nutrition") => { window.history.pushState({}, "", path); render(<AccountSession><AccountUnavailable><Page /></AccountUnavailable></AccountSession>); };
const answer = (status: number, body: unknown = {}) => vi.fn().mockResolvedValue(Response.json(body, { status }));

describe("account session states", () => {
  it("treats a 401 as signed out, not as an outage", async () => {
    vi.stubGlobal("fetch", answer(401)); show();
    expect(await screen.findByText("Sign in")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("never asks a member to sign in when the server fails", async () => {
    vi.stubGlobal("fetch", answer(503)); show();
    expect((await screen.findByRole("alert")).textContent).toContain("We can’t reach your account");
    expect(screen.queryByText("Sign in")).toBeNull();
  });
  it("treats a network failure as an outage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))); show();
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
  it("keeps the device journal open during an outage", async () => {
    vi.stubGlobal("fetch", answer(503)); show("/journal");
    expect(await screen.findByText("Sign in")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("recovers with Try again", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 503 })).mockResolvedValue(Response.json({ id: "u1", email: "a@b.c", profile: {} }));
    vi.stubGlobal("fetch", fetchMock); show();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("member u1")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("retries by itself when the connection returns", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(Response.json({ id: "u2", email: "a@b.c", profile: {} }));
    vi.stubGlobal("fetch", fetchMock); show();
    await screen.findByRole("alert");
    await waitFor(() => { window.dispatchEvent(new Event("online")); expect(screen.getByText("member u2")).toBeTruthy(); });
  });
});
