import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, it, expect, vi } from "vitest";
import { AccountRecovery } from "../src/components/account-recovery";
import { StrictMode } from "react";
import Onboarding from "../src/app/onboarding/page";
beforeEach(()=>{localStorage.clear();window.history.replaceState(null,"","/");});
it("captures a recovery token without leaving it in the URL and submits it only on confirmation",async()=>{
  window.history.replaceState(null,"","/reset-password#token="+"a".repeat(64));
  const fetcher=vi.fn().mockResolvedValue(Response.json({status:"Password reset"}));vi.stubGlobal("fetch",fetcher);
  render(<StrictMode><AccountRecovery mode="reset-password"/></StrictMode>);expect(window.location.hash).toBe("");expect(fetcher).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText("New password"),"Replacement-password-123");await userEvent.click(screen.getByRole("button",{name:"Reset password"}));
  expect((await screen.findByRole("status")).textContent).toContain("Password reset");expect(JSON.parse(fetcher.mock.calls[0][1].body).token).toBe("a".repeat(64));
});
it("reports delivery setup errors without inventing a sent email",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({error:"Email delivery is not configured"},{status:503})));
  render(<AccountRecovery mode="forgot-password"/>);await userEvent.type(screen.getByLabelText("Email address"),"qa@example.com");await userEvent.click(screen.getByRole("button",{name:"Send recovery link"}));expect((await screen.findByRole("alert")).textContent).toContain("not configured");
});
it("completes onboarding with validated goals and planning preferences in the existing workspace",async()=>{
  render(<Onboarding/>);fireEvent.change(screen.getByLabelText("Daily calorie target"),{target:{value:"2200"}});fireEvent.change(screen.getByLabelText("Daily protein target (g)"),{target:{value:"120"}});
  await userEvent.click(screen.getByRole("button",{name:"Continue"}));fireEvent.change(screen.getByLabelText("Daily food budget"),{target:{value:"350"}});await userEvent.click(screen.getByRole("button",{name:"Continue"}));await userEvent.click(screen.getByRole("button",{name:"Finish setup"}));
  await waitFor(()=>expect(screen.getByText("You’re ready to begin.")).toBeTruthy());expect(JSON.parse(localStorage.getItem("trackcal:target:calories")!)).toBe(2200);expect(JSON.parse(localStorage.getItem("trackcal:preferences")!).dailyBudget).toBe(350);
});
