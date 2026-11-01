import { describe, expect, it, vi } from 'vitest';
import { executeCommand, type CommandActions } from '../src/main/command';
import { WhisperService } from '../src/main/voice';

function actions() {
  const launchApp = vi.fn(async () => undefined);
  const openFolder = vi.fn(async () => undefined);
  return { launchApp, openFolder } as CommandActions & { launchApp: typeof launchApp; openFolder: typeof openFolder };
}

describe('recognized speech through the command handler', () => {
  it('routes a Whisper transcription to the approved VS Code launcher', async () => {
    const action = actions();
    const whisperExec = vi.fn((_file, _args, _options, callback) => {
      callback(null, '[00:00:00.000 --> 00:00:02.000] Open Visual Studio Code.\n', '');
      return {} as never;
    });
    const whisper = new WhisperService({ whisperExecutable: 'C:\\Whisper\\whisper-cli.exe', whisperModel: 'C:\\Whisper\\model.bin', speechEnabled: true }, whisperExec, { fileExists: async () => true });
    const recognized = await whisper.transcribeWav(new Uint8Array([1, 2, 3]));
    const result = await executeCommand(recognized, action);
    expect(recognized).toBe('Open Visual Studio Code.');
    expect(result).toMatchObject({ ok: true, message: 'Opening VS Code.', intent: { kind: 'launch-app', normalizedText: 'open visual studio code', app: 'vscode' } });
    expect(action.launchApp).toHaveBeenCalledTimes(1);
    expect(action.launchApp).toHaveBeenCalledWith('vscode');
    expect(action.openFolder).not.toHaveBeenCalled();
  });

  it.each([
    'Open Visual Studio Code', 'Jarvis, open Visual Studio Code.',
    'Launch Microsoft Visual Studio Code', 'Open Visual-Studio Code',
    'Open Visual Studio, Code', 'Open Visual Studio Code editor',
    'Open VS Code', 'Open V S Code'
  ])('routes the exact recognized phrase %s to VS Code', async (recognized) => {
    const action = actions();
    const result = await executeCommand(recognized, action);
    expect(result.intent).toMatchObject({ kind: 'launch-app', app: 'vscode' });
    expect(action.launchApp).toHaveBeenCalledTimes(1);
    expect(action.launchApp).toHaveBeenCalledWith('vscode');
  });

  it.each(['Open code', 'Open Visual Studio', 'Open Microsoft Visual Studio'])('asks for clarification for %s', async (recognized) => {
    const action = actions();
    const result = await executeCommand(recognized, action);
    expect(result.intent.kind).toBe('ambiguous');
    expect(result.ok).toBe(false);
    expect(action.launchApp).not.toHaveBeenCalled();
  });

  it.each(['Open a code editor', 'Open Visual Studio Community', 'Open Visual Studio Code and Chrome'])('does not guess for %s', async (recognized) => {
    const action = actions();
    const result = await executeCommand(recognized, action);
    expect(result.intent.kind).toBe('unknown');
    expect(action.launchApp).not.toHaveBeenCalled();
  });

  it('preserves launcher failure instead of reporting a successful launch', async () => {
    const action = actions();
    action.launchApp.mockRejectedValueOnce(new Error('VS Code was not found'));
    const result = await executeCommand('Open Visual Studio Code', action);
    expect(result).toMatchObject({ ok: false, message: 'VS Code was not found', intent: { kind: 'launch-app', app: 'vscode' } });
  });
});
