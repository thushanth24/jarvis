import { describe, expect, it, vi } from 'vitest';
import { normalizeTranscription, resolveWhisperConfiguration, WhisperService } from '../src/main/voice';
import { microphoneErrorMessage, transitionVoiceState } from '../src/core/voice-state';

describe('Whisper configuration and offline voice adapters', () => {
  it('normalizes Whisper timestamps and whitespace', () => {
    expect(normalizeTranscription('[00:00:00.000 --> 00:00:01.000]  Open   Chrome ')).toBe('Open Chrome');
  });

  it('loads valid executable and model paths from environment variables', async () => {
    const executable = 'C:\\Tools\\whisper-cli.exe'; const model = 'C:\\Tools\\ggml-tiny.en.bin';
    const result = await resolveWhisperConfiguration({ environment: { JARVIS_WHISPER_CLI: executable, JARVIS_WHISPER_MODEL: model }, fileExists: async (candidate) => candidate === executable || candidate === model });
    expect(result).toMatchObject({ executable, model, executableSource: 'environment', modelSource: 'environment' });
  });

  it('automatically detects the JARVIS local installation', async () => {
    const localAppData = 'C:\\Users\\Test\\AppData\\Local'; const executable = `${localAppData}\\JARVIS\\whisper\\Release\\whisper-cli.exe`; const model = `${localAppData}\\JARVIS\\whisper\\models\\ggml-tiny.en.bin`;
    const result = await resolveWhisperConfiguration({ environment: {}, localAppData, fileExists: async (candidate) => candidate === executable || candidate === model });
    expect(result).toMatchObject({ executable, model, executableSource: 'automatic', modelSource: 'automatic' });
  });

  it('prefers valid user paths, then valid environment paths over automatic detection', async () => {
    const userExecutable = 'D:\\User\\whisper-cli.exe'; const envExecutable = 'E:\\Env\\whisper-cli.exe'; const autoExecutable = 'C:\\Users\\Test\\AppData\\Local\\JARVIS\\whisper\\whisper-cli.exe';
    const userModel = 'D:\\User\\model.bin'; const envModel = 'E:\\Env\\model.bin'; const autoModel = 'C:\\Users\\Test\\AppData\\Local\\JARVIS\\whisper\\models\\ggml-tiny.en.bin';
    const exists = async (candidate: string | null) => [userExecutable, envExecutable, autoExecutable, userModel, envModel, autoModel].includes(candidate ?? '');
    const user = await resolveWhisperConfiguration({ configuredExecutable: userExecutable, configuredModel: userModel, environment: { JARVIS_WHISPER_CLI: envExecutable, JARVIS_WHISPER_MODEL: envModel }, localAppData: 'C:\\Users\\Test\\AppData\\Local', fileExists: exists });
    expect(user).toMatchObject({ executable: userExecutable, model: userModel, executableSource: 'user', modelSource: 'user' });
    const environment = await resolveWhisperConfiguration({ configuredExecutable: 'C:\\Missing\\cli.exe', configuredModel: 'C:\\Missing\\model.bin', environment: { JARVIS_WHISPER_CLI: envExecutable, JARVIS_WHISPER_MODEL: envModel }, localAppData: 'C:\\Users\\Test\\AppData\\Local', fileExists: exists });
    expect(environment).toMatchObject({ executable: envExecutable, model: envModel, executableSource: 'environment', modelSource: 'environment' });
  });

  it('reports missing executable and missing model separately', async () => {
    const missingExecutable = new WhisperService({ whisperExecutable: 'C:\\Missing\\whisper-cli.exe', whisperModel: 'C:\\Valid\\model.bin', speechEnabled: true }, undefined, { fileExists: async (candidate) => candidate === 'C:\\Valid\\model.bin', localAppData: 'C:\\No\\JARVIS' });
    await expect(missingExecutable.transcribeWav(new Uint8Array([1]))).rejects.toThrow('Whisper executable not found');
    const missingModel = new WhisperService({ whisperExecutable: 'C:\\Valid\\whisper-cli.exe', whisperModel: 'C:\\Missing\\model.bin', speechEnabled: true }, undefined, { fileExists: async (candidate) => candidate === 'C:\\Valid\\whisper-cli.exe', localAppData: 'C:\\No\\JARVIS' });
    await expect(missingModel.transcribeWav(new Uint8Array([1]))).rejects.toThrow('Whisper model not found');
  });

  it('invokes transcription with absolute executable, model, and temporary WAV paths', async () => {
    const exec = vi.fn((_file, _args, _options, callback) => { callback(null, 'Open Chrome', ''); return {} as never; });
    const service = new WhisperService({ whisperExecutable: 'C:\\Valid\\whisper-cli.exe', whisperModel: 'C:\\Valid\\ggml-tiny.en.bin', speechEnabled: true }, exec, { fileExists: async () => true });
    await expect(service.transcribeWav(new Uint8Array([1, 2, 3]))).resolves.toBe('Open Chrome');
    expect(exec).toHaveBeenCalledWith('C:\\Valid\\whisper-cli.exe', expect.arrayContaining(['-m', 'C:\\Valid\\ggml-tiny.en.bin', '-nt', '--prompt', expect.stringContaining('VS Code')]), expect.anything(), expect.any(Function));
  });

  it('distinguishes a failed Whisper process launch', async () => {
    const exec = vi.fn((_file, _args, _options, callback) => { const error = Object.assign(new Error('spawn failed'), { code: 'ENOENT' }); callback(error, '', ''); return {} as never; });
    const service = new WhisperService({ whisperExecutable: 'C:\\Valid\\whisper-cli.exe', whisperModel: 'C:\\Valid\\ggml-tiny.en.bin', speechEnabled: true }, exec, { fileExists: async () => true });
    await expect(service.transcribeWav(new Uint8Array([1]))).rejects.toThrow('Unable to launch Whisper');
  });

  it('models listening, cancellation, processing, execution and speaking states', () => {
    expect(transitionVoiceState('idle', 'start')).toBe('listening'); expect(transitionVoiceState('listening', 'cancel')).toBe('idle'); expect(transitionVoiceState('listening', 'stop')).toBe('processing'); expect(transitionVoiceState('processing', 'transcription-complete')).toBe('executing'); expect(transitionVoiceState('executing', 'execution-complete')).toBe('speaking'); expect(transitionVoiceState('speaking', 'speech-complete')).toBe('idle');
  });

  it('provides a safe missing-microphone message', () => { expect(microphoneErrorMessage()).toContain('Microphone access is unavailable'); });
});
