import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FoodCamera } from "@/components/food-camera";

const stream = () => { const stop = vi.fn(); return { stop, value: { getTracks: () => [{ stop }] } as unknown as MediaStream }; };
const camera = (impl: () => Promise<MediaStream>) => Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(impl) } });
const props = { consent: true, onConsent: vi.fn(), onCapture: vi.fn(), onClose: vi.fn() };
HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

describe("food camera", () => {
  it("captures a JPEG frame and stops the camera on close", async () => {
    const { stop, value } = stream(); camera(async () => value);
    vi.spyOn(HTMLVideoElement.prototype, "videoWidth", "get").mockReturnValue(1920);
    vi.spyOn(HTMLVideoElement.prototype, "videoHeight", "get").mockReturnValue(1080);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (done) { done(new Blob(["x"], { type: "image/jpeg" })); });
    const onCapture = vi.fn(), view = render(<FoodCamera {...props} onCapture={onCapture} />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Snap and estimate calories" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Snap and estimate calories" }));
    expect((onCapture.mock.calls[0][0] as File).type).toBe("image/jpeg");
    view.unmount(); expect(stop).toHaveBeenCalled();
  });
  it("explains a blocked camera and offers no working shutter", async () => {
    camera(async () => { throw new DOMException("no", "NotAllowedError"); });
    render(<FoodCamera {...props} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Camera access is blocked");
    expect((screen.getByRole("button", { name: "Snap and estimate calories" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("names the shutter honestly when AI consent is off", () => {
    camera(() => new Promise(() => {})); render(<FoodCamera {...props} consent={false} />);
    expect(screen.getByRole("button", { name: "Snap photo" })).toBeTruthy();
  });
  it("closes with Escape", () => {
    camera(() => new Promise(() => {})); const onClose = vi.fn(); render(<FoodCamera {...props} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" }); expect(onClose).toHaveBeenCalled();
  });
});
