import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { VoiceRecorder } from "../src/components/voice-recorder";
afterEach(()=>vi.unstubAllGlobals());
it("reports permission errors and never uploads a failed recording", async () => {
  vi.stubGlobal("MediaRecorder",class {}); Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockRejectedValue(new Error("Permission denied"))}});
  const callback=vi.fn(); render(<VoiceRecorder disabled={false} onRecording={callback}/>); fireEvent.click(screen.getByRole("button",{name:"Record meal"}));
  expect((await screen.findByRole("alert")).textContent).toContain("Permission denied"); expect(callback).not.toHaveBeenCalled();
});
it("stops microphone tracks when the component unmounts", async () => {
  const stop=vi.fn(); Object.defineProperty(navigator,"mediaDevices",{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});
  vi.stubGlobal("MediaRecorder",class {state="inactive"; start(){this.state="recording";} stop(){this.state="inactive";}});
  const view=render(<VoiceRecorder disabled={false} onRecording={vi.fn()}/>); fireEvent.click(screen.getByRole("button",{name:"Record meal"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Stop and transcribe"})).toBeTruthy()); view.unmount(); expect(stop).toHaveBeenCalled();
});
