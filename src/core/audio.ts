/** Encodes mono Float32 samples as the 16 kHz, signed 16-bit PCM WAV Whisper expects. */
export function encodePcm16Wav(chunks: Float32Array[], sampleRate: number): ArrayBuffer {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0); const samples = new Float32Array(length); let offset = 0;
  for (const chunk of chunks) { samples.set(chunk, offset); offset += chunk.length; }
  const targetRate = 16000; const ratio = sampleRate / targetRate; const outputLength = Math.max(1, Math.round(samples.length / ratio)); const output = new ArrayBuffer(44 + outputLength * 2); const view = new DataView(output);
  const write = (position: number, value: string) => [...value].forEach((character, index) => view.setUint8(position + index, character.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + outputLength * 2, true); write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, outputLength * 2, true);
  for (let index = 0; index < outputLength; index += 1) { const sourceIndex = Math.min(samples.length - 1, Math.floor(index * ratio)); const sample = Math.max(-1, Math.min(1, samples[sourceIndex] ?? 0)); view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); }
  return output;
}
