import { it, expect } from "vitest";
import { encodeWav } from "../src/lib/wav";
it("resamples stereo audio to the exact local Whisper WAV format and clamps samples", () => {
  const samples = new Float32Array(48000).fill(2);
  const result = encodeWav([samples,samples],48000), view = new DataView(result);
  expect(result.byteLength).toBe(32044); expect(view.getUint16(22,true)).toBe(1); expect(view.getUint32(24,true)).toBe(16000); expect(view.getUint16(34,true)).toBe(16); expect(view.getInt16(44,true)).toBe(32767);
});
it("caps speech at 60 seconds and rejects invalid channel data", () => {
  expect(encodeWav([new Float32Array(16000*61)],16000).byteLength).toBe(1920044);
  expect(()=>encodeWav([],16000)).toThrow(); expect(()=>encodeWav([new Float32Array(1)],0)).toThrow();
});
