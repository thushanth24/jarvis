import { describe, expect, it, vi } from 'vitest';
import { WindowsSpeechService, windowsPowerShellPath } from '../src/main/speech';

function fakePowerShell() {
  const requests: Array<{ args: string[]; options: { env?: NodeJS.ProcessEnv }; callback: (error: Error | null) => void; kill: ReturnType<typeof vi.fn> }> = [];
  const execute = vi.fn((_file, args, options, callback) => {
    const child = { killed: false, kill: vi.fn(() => { child.killed = true; callback(new Error('cancelled')); return true; }) };
    requests.push({ args, options, callback, kill: child.kill });
    if (!args[3].includes('JARVIS_TTS_TEXT')) callback(null);
    return child;
  });
  const service = new WindowsSpeechService(execute as never, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', async () => true);
  return { service, requests, execute };
}

describe('offline Windows speech service', () => {
  it('selects Windows PowerShell 5.1 by absolute system path', () => {
    expect(windowsPowerShellPath({ SystemRoot: 'D:\\Windows' })).toBe('D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  });

  it('awaits speech completion and transfers Unicode text through environment variables', async () => {
    const { service, requests, execute } = fakePowerShell();
    const speech = service.speak('வணக்கம் JARVIS');
    await vi.waitFor(() => expect(requests.length).toBe(2));
    expect(requests[1].args[3]).toContain('Add-Type -AssemblyName System.Speech');
    expect(requests[1].args[3]).toContain('Dispose()');
    expect(requests[1].options.env?.JARVIS_TTS_TEXT).toBe('வணக்கம் JARVIS');
    expect(execute.mock.calls[1][0]).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    requests[1].callback(null);
    await expect(speech).resolves.toBe('completed');
  });

  it('reports process failure instead of pretending speech completed', async () => {
    const { service, requests } = fakePowerShell();
    const speech = service.speak('Hello');
    await vi.waitFor(() => expect(requests.length).toBe(2));
    requests[1].callback(new Error('failed'));
    await expect(speech).rejects.toThrow('Windows speech synthesis failed');
  });

  it('cancels speech and prevents overlapping requests', async () => {
    const { service, requests } = fakePowerShell();
    const first = service.speak('First');
    await vi.waitFor(() => expect(requests.length).toBe(2));
    const second = service.speak('Second');
    await vi.waitFor(() => expect(requests.length).toBe(3));
    await expect(first).resolves.toBe('cancelled');
    expect(requests[1].kill).toHaveBeenCalledTimes(1);
    expect(service.stop()).toBe(true);
    await expect(second).resolves.toBe('cancelled');
    expect(requests[2].kill).toHaveBeenCalledTimes(1);
    expect(service.stop()).toBe(false);
  });

  it('reports unavailable engine and rejects invalid text without starting speech', async () => {
    const service = new WindowsSpeechService(vi.fn() as never, null);
    expect(await service.available()).toBe(false);
    await expect(service.speak('Hello')).rejects.toThrow('unavailable');
    await expect(service.speak('')).rejects.toThrow('1 to 500');
  });
});
