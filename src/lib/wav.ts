// Encode a mono recording as the PCM format accepted by the local Whisper worker.
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  if (!channels.length || channels.some(channel => channel.length !== channels[0].length) || !Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error("Invalid microphone recording.");
  const length = Math.min(960000, Math.floor(channels[0].length * 16000 / sampleRate));
  const data = new ArrayBuffer(44 + length * 2), view = new DataView(data);
  const word = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  word(0, "RIFF"); view.setUint32(4, 36 + length * 2, true); word(8, "WAVE"); word(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); word(36, "data"); view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) {
    const position = i * sampleRate / 16000, left = Math.floor(position), fraction = position - left;
    const value = channels.reduce((sum, channel) => sum + channel[left] * (1 - fraction) + (channel[Math.min(left + 1, channel.length - 1)] || 0) * fraction, 0) / channels.length;
    const clipped = Math.max(-1, Math.min(1, value)); view.setInt16(44 + i * 2, Math.round(clipped * (clipped < 0 ? 32768 : 32767)), true);
  }
  return data;
}
