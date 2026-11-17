import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Page from "@/app/body-preview/page";

vi.mock("@/components/account-session", () => ({ useAccount: () => ({ ready: true, user: { id: "member" } }), useWorkspaceScope: () => "member" }));
vi.mock("@/lib/photo-prep", () => ({ preparePhoto: async () => "data:image/jpeg;base64,AAAA" }));
const show = () => render(<MemoryRouter><Page /></MemoryRouter>);
const reply = (status: number, body: unknown = {}) => Response.json(body, { status });

describe("body preview", () => {
  it("says it is unavailable while the flag is off", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(404))); show();
    expect(await screen.findByText("Body preview isn’t available yet")).toBeTruthy();
  });
  it("tells a non-adult account it is for adults, with no upload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(403))); show();
    expect(await screen.findByText("Body preview is for adults")).toBeTruthy();
    expect(screen.queryByLabelText("Your photo")).toBeNull();
  });
  it("needs a photo and all three confirmations, then shows a labelled result", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST" ? reply(200, { image: "data:image/png;base64,BBBB", notice: "AI illustration, not a prediction of your body." }) : reply(200, {}));
    vi.stubGlobal("fetch", fetchMock); show();
    const create = await screen.findByRole("button", { name: "Create my preview" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Your photo"), { target: { files: [new File(["x"], "me.jpg", { type: "image/jpeg" })] } });
    await screen.findByAltText("Your chosen photo");
    const boxes = screen.getAllByRole("checkbox"); expect(boxes.length).toBe(3);
    fireEvent.click(boxes[0]); fireEvent.click(boxes[1]); expect(create.disabled).toBe(true);
    fireEvent.click(boxes[2]); expect(create.disabled).toBe(false);
    fireEvent.click(create);
    expect(await screen.findByText("AI illustration")).toBeTruthy();
    const sent = JSON.parse(String(fetchMock.mock.calls.find(call => call[1]?.method === "POST")?.[1]?.body));
    expect(sent).toMatchObject({ goal: "toned", confirm_adult: true, confirm_own_photo: true, confirm_ai_transfer: true });
    fireEvent.click(screen.getByRole("button", { name: "Start again and delete" }));
    await waitFor(() => expect(screen.queryByAltText("AI illustration of your goal")).toBeNull());
    expect(screen.queryByAltText("Your chosen photo")).toBeNull();
  });
});
