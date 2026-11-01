import { describe, expect, it, vi } from 'vitest';
import { MicrophoneCapture } from '../src/renderer/microphone';

function microphoneFixture() {
  const stopTrack = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
  const processor = { onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null, connect: vi.fn(), disconnect: vi.fn() };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const mute = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  const context = { sampleRate: 16000, resume: vi.fn(async () => undefined), close: vi.fn(async () => undefined), createMediaStreamSource: vi.fn(() => source), createScriptProcessor: vi.fn(() => processor), createGain: vi.fn(() => mute), destination: {} };
  const getStream = vi.fn(async () => stream);
  const capture = new MicrophoneCapture(getStream, () => context as unknown as AudioContext);
  const sample = (samples: number[]) => processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(samples) } } as unknown as AudioProcessingEvent);
  return { capture, stopTrack, stream, context, processor, source, mute, getStream, sample };
}

describe('microphone resource lifecycle', () => {
  it('stops tracks before returning all captured audio, then supports another recording', async () => {
    const fixture = microphoneFixture();
    await fixture.capture.start(); fixture.sample([0.25, -0.25]); fixture.sample([0.5]);
    const audio = await fixture.capture.stop();
    expect(fixture.stopTrack).toHaveBeenCalledTimes(1);
    expect(fixture.context.close).toHaveBeenCalledTimes(1);
    expect(audio?.chunks.map((chunk) => Array.from(chunk))).toEqual([[0.25, -0.25], [0.5]]);
    expect(fixture.capture.active).toBe(false);
    await fixture.capture.start(); fixture.sample([1]);
    expect((await fixture.capture.stop())?.chunks[0][0]).toBe(1);
    expect(fixture.stopTrack).toHaveBeenCalledTimes(2);
  });

  it('cancels on Escape or window hide without retaining audio or executing a command', async () => {
    const fixture = microphoneFixture();
    await fixture.capture.start(); fixture.sample([0.4]);
    fixture.capture.cancel(); fixture.capture.cancel();
    expect(fixture.stopTrack).toHaveBeenCalledTimes(1);
    expect(fixture.processor.onaudioprocess).toBeNull();
    expect(await fixture.capture.stop()).toBeNull();
    expect(fixture.capture.active).toBe(false);
  });

  it('cleans up when Web Audio initialization fails after permission was granted', async () => {
    const fixture = microphoneFixture();
    fixture.context.resume.mockRejectedValueOnce(new Error('device failure'));
    await expect(fixture.capture.start()).rejects.toThrow('device failure');
    expect(fixture.stopTrack).toHaveBeenCalledTimes(1);
    expect(fixture.context.close).toHaveBeenCalledTimes(1);
    expect(fixture.capture.active).toBe(false);
  });

  it('stops tracks even if an audio node throws during connection cleanup', async () => {
    const fixture = microphoneFixture();
    fixture.processor.connect.mockImplementationOnce(() => { throw new Error('audio graph failure'); });
    fixture.processor.disconnect.mockImplementationOnce(() => { throw new Error('disconnect failure'); });
    await expect(fixture.capture.start()).rejects.toThrow('audio graph failure');
    expect(fixture.stopTrack).toHaveBeenCalledTimes(1);
    expect(fixture.context.close).toHaveBeenCalledTimes(1);
  });

  it('does not create audio resources when microphone permission is denied', async () => {
    const fixture = microphoneFixture();
    fixture.getStream.mockRejectedValueOnce(new Error('denied'));
    await expect(fixture.capture.start()).rejects.toThrow('denied');
    expect(fixture.context.resume).not.toHaveBeenCalled();
  });

  it('stops a stream that arrives after cancellation', async () => {
    const fixture = microphoneFixture();
    let grantPermission!: (stream: MediaStream) => void;
    fixture.getStream.mockImplementationOnce(() => new Promise((resolve) => { grantPermission = resolve; }));
    const starting = fixture.capture.start();
    fixture.capture.cancel();
    grantPermission(fixture.stream);
    await starting;
    expect(fixture.stopTrack).toHaveBeenCalledTimes(1);
    expect(fixture.capture.active).toBe(false);
  });
});
