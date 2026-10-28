import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
import { AuthForm } from "../src/components/auth-form";
beforeEach(() => { push.mockReset(); });
it("recovers from an authentication timeout without inviting duplicate signup", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Expired", "TimeoutError")));
  const user = userEvent.setup(); render(<AuthForm signup />);
  await user.type(screen.getByLabelText("Your name"), "QA");
  await user.type(screen.getByLabelText("Email address"), "qa@example.com");
  await user.type(screen.getByLabelText(/^Password/), "Test-password-123");
  await user.click(screen.getByRole("button", { name: "Create free account" }));
  expect((await screen.findByRole("alert")).textContent).toContain("try signing in");
  expect((screen.getByRole("button", { name: "Create free account" }) as HTMLButtonElement).disabled).toBe(false);
  expect(push).not.toHaveBeenCalled();
});
it("announces pending sign-in and prevents repeated submission", async () => {
  let resolve!: (value: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(done => { resolve = done; }));
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup(); render(<AuthForm />);
  await user.type(screen.getByLabelText("Email address"), "qa@example.com");
  await user.type(screen.getByLabelText(/^Password/), "Test-password-123");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  const pending = screen.getByRole("button", { name: "Signing you in…" });
  expect((pending as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("Securely connecting");
  await user.click(pending); expect(fetcher).toHaveBeenCalledOnce();
  resolve(Response.json({ error: "Please try again" }, { status: 503 }));
  expect((await screen.findByRole("alert")).textContent).toContain("Please try again");
  expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
});
it("signs in with entered credentials and opens the account", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: "Signed in" })); vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup(); render(<AuthForm />);
  await user.type(screen.getByLabelText("Email address"), "qa@example.com");
  await user.type(screen.getByLabelText(/^Password/), "Test-password-123");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/account"));
  expect(JSON.parse(fetcher.mock.calls[0][1].body).email).toBe("qa@example.com");
  expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText(/^Password/) as HTMLInputElement).value).toBe("");
  expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
});
it("keeps failed sign-in on the page with a clear error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Invalid credentials" }, { status: 401 })));
  const user = userEvent.setup(); render(<AuthForm />);
  await user.type(screen.getByLabelText("Email address"), "qa@example.com"); await user.type(screen.getByLabelText(/^Password/), "incorrect"); await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Invalid credentials"); expect(push).not.toHaveBeenCalled();
});
it("registers an account with a name and permits checking the password", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: "Account created" })); vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup(); render(<AuthForm signup />);
  await user.type(screen.getByLabelText("Your name"), "QA"); await user.type(screen.getByLabelText("Email address"), "qa@example.com"); await user.type(screen.getByLabelText(/^Password/), "Test-password-123");
  await user.click(screen.getByRole("button", { name: "Show password" })); expect(screen.getByLabelText(/^Password/).getAttribute("type")).toBe("text");
  await user.click(screen.getByRole("button", { name: "Create free account" })); await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding")); expect(JSON.parse(fetcher.mock.calls[0][1].body).display_name).toBe("QA");
});
