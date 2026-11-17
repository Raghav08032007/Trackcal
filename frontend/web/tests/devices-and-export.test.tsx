import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Blob as NodeBlob } from "node:buffer";
import { BarcodeCamera } from "../src/components/barcode-camera";
import { VoiceInput } from "../src/components/voice-input";
import { JournalTools } from "../src/components/journal-tools";
const camera = vi.hoisted(() => ({ stop: vi.fn(), decode: vi.fn() }));
vi.mock("@zxing/browser", () => ({ BrowserMultiFormatOneDReader: class { scan = camera.decode; } }));
beforeEach(() => { camera.stop.mockReset(); camera.decode.mockReset(); Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getVideoTracks:()=>[],getTracks:()=>[]})}}); vi.spyOn(HTMLMediaElement.prototype,'play').mockImplementation(function(this:HTMLMediaElement){this.dispatchEvent(new Event('playing'));return Promise.resolve();}); });
describe("camera lifecycle", () => {
  it("decodes a barcode and stops the camera", async () => {
    const onCode = vi.fn(); camera.decode.mockImplementation((_video, callback) => { callback({ getText: () => "12345678" }, null, { stop: camera.stop }); callback({ getText: () => "12345678" }, null, { stop: camera.stop }); return { stop: camera.stop }; });
    render(<BarcodeCamera onCode={onCode} />); fireEvent.click(screen.getByRole("button", { name: "Scan barcode with camera" })); await waitFor(() => expect(onCode).toHaveBeenCalledWith("12345678")); expect(camera.stop).toHaveBeenCalled(); expect(screen.queryByRole("button", { name: "Stop camera" })).toBeNull();
  });
  it("provides typed-code fallback after denied permission", async () => { vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new Error("denied")); render(<BarcodeCamera onCode={vi.fn()} />); fireEvent.click(screen.getByRole("button", { name: "Scan barcode with camera" })); expect(await screen.findByRole("alert")).toBeTruthy(); });
  it("stops the camera when the scanner unmounts", async () => { camera.decode.mockReturnValue({ stop: camera.stop }); const { unmount } = render(<BarcodeCamera onCode={vi.fn()} />); fireEvent.click(screen.getByRole("button", { name: "Scan barcode with camera" })); await waitFor(() => expect(camera.decode).toHaveBeenCalled()); unmount(); expect(camera.stop).toHaveBeenCalled(); });
});
describe("voice lifecycle", () => {
  it("provides an unsupported-browser fallback", () => { render(<VoiceInput onText={vi.fn()} />); fireEvent.click(screen.getByRole("button", { name: "Speak a meal" })); expect(screen.getByRole("alert").textContent).toContain("unavailable"); });
  it("transcribes speech, handles permission errors and aborts on unmount", () => {
    const abort = vi.fn(), start = vi.fn(), onText = vi.fn(); const instances: Recognition[] = [];
    class Recognition { abort = abort; start = start; onresult: ((event: { results: { transcript: string }[][] }) => void) | null = null; onerror: (() => void) | null = null; onend: (() => void) | null = null; constructor() { instances.push(this); } }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: Recognition });
    const { unmount } = render(<VoiceInput onText={onText} />); fireEvent.click(screen.getByRole("button", { name: "Speak a meal" })); expect(start).toHaveBeenCalled();
    const recognizer = instances[0]; act(() => recognizer.onresult?.({ results: [[{ transcript: "Two eggs" }]] })); expect(onText).toHaveBeenCalledWith("Two eggs");
    act(() => recognizer.onerror?.()); unmount(); expect(abort).toHaveBeenCalled(); delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
  });
});
describe("portable export", () => {
  it("exports every date and excludes unrelated browser data", async () => {
    vi.stubGlobal("Blob", NodeBlob); vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    localStorage.setItem("private-unrelated-key", "secret"); localStorage.setItem("trackcal:target:calories", "2200"); localStorage.setItem("trackcal:journal:2026-10-01", "[]");
    render(<JournalTools date="2026-10-20" onDate={vi.fn()} meals={[]} setMeals={vi.fn()} />); fireEvent.click(screen.getByRole("button", { name: "Export all local data (JSON)" }));
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as unknown as NodeBlob; const data = JSON.parse(await blob.text()); expect(data.version).toBe(1); expect(data.entries["trackcal:target:calories"]).toBe(2200); expect(data.entries["trackcal:journal:2026-10-01"]).toEqual([]); expect(data.entries["private-unrelated-key"]).toBeUndefined();
  });
});
describe("speech fallback", () => {
  it("records when the browser speech service fails, as it often does in Edge", async () => {
    const start = vi.fn(), instances: { onerror: ((event: { error: string }) => void) | null }[] = [];
    class Recognition { start = start; abort = vi.fn(); onerror = null; onresult = null; onend = null; constructor() { instances.push(this); } }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: Recognition });
    render(<VoiceInput onText={vi.fn()} />); fireEvent.click(screen.getByRole("button", { name: "Speak a meal" }));
    act(() => instances[0].onerror?.({ error: "network" }));
    expect((await screen.findByRole("alert")).textContent).toContain("unavailable");
    delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
  });
});
