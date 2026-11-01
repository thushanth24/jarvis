import { describe, expect, it, vi } from 'vitest';
import { executeVoiceCommand, speakReply } from '../src/renderer/speech-flow';
import { classifyCommand } from '../src/core/router';

describe('speech response flow', () => {
  it('speaks a completed command response and reports start then completion', async () => {
    const speak = vi.fn(async () => 'completed' as const);
    const states: string[] = [];
    const execute = vi.fn(async () => ({ ok: true, message: 'Opening VS Code.', intent: classifyCommand('Open VS Code') }));
    await executeVoiceCommand('Open VS Code', execute, () => undefined, (text) => speakReply(text, true, speak, (state) => states.push(state)));
    expect(speak).toHaveBeenCalledWith('Opening VS Code.');
    expect(states).toEqual(['started', 'completed']);
  });

  it('does not request speech when disabled', async () => {
    const speak = vi.fn(); const states: string[] = [];
    await speakReply('Opening VS Code.', false, speak, (state) => states.push(state));
    expect(speak).not.toHaveBeenCalled();
    expect(states).toEqual(['disabled']);
  });

  it('reports cancellation and failure separately', async () => {
    const states: string[] = [];
    await speakReply('Hello', true, async () => 'cancelled', (state) => states.push(state));
    expect(states).toEqual(['started', 'cancelled']);
    states.length = 0;
    await expect(speakReply('Hello', true, async () => { throw new Error('failed'); }, (state) => states.push(state))).rejects.toThrow('failed');
    expect(states).toEqual(['started', 'failed']);
  });
});
