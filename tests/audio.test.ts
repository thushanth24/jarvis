import { describe, expect, it } from 'vitest';
import { encodePcm16Wav } from '../src/core/audio';

describe('Whisper WAV input', () => {
  it('encodes mono signed 16-bit PCM at 16 kHz', () => {
    const wav = encodePcm16Wav([new Float32Array([0, 0.5, -0.5, 1])], 16000);
    const view = new DataView(wav);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
  });
});
