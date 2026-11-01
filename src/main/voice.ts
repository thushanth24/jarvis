import { execFile, type ChildProcess } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface VoiceConfig {
  whisperExecutable?: string;
  whisperModel?: string;
  voiceName?: string;
  speechEnabled: boolean;
  initialPrompt?: string;
}

export const DEFAULT_WHISPER_INITIAL_PROMPT = 'JARVIS, VS Code, Visual Studio Code, Chrome.';

export interface WhisperResolution {
  executable: string | null;
  model: string | null;
  executableSource: 'user' | 'environment' | 'automatic' | 'missing';
  modelSource: 'user' | 'environment' | 'automatic' | 'missing';
  checkedExecutablePaths: string[];
  checkedModelPaths: string[];
}

export interface VoiceAvailability {
  whisperExecutable: string | null;
  whisperModel: string | null;
  speechAvailable: boolean;
  configurationSource?: { executable: WhisperResolution['executableSource']; model: WhisperResolution['modelSource'] };
}

type ExecFile = (file: string, args: string[], options: Parameters<typeof execFile>[2], callback: (error: Error | null, stdout: string, stderr: string) => void) => ChildProcess;
type FileExists = (filePath: string | null) => Promise<boolean>;
type Logger = (message: string) => void;

function absoluteWindowsPath(value?: string): string | null {
  const candidate = value?.trim();
  return candidate && path.win32.isAbsolute(candidate) ? path.win32.normalize(candidate) : null;
}

async function exists(filePath: string | null): Promise<boolean> {
  if (!filePath) return false;
  try { await access(filePath, constants.F_OK); return true; } catch { return false; }
}

function developmentLogger(): Logger | undefined {
  return process.env.NODE_ENV === 'development' || Boolean(process.env.VITE_DEV_SERVER_URL)
    ? (message) => console.debug(`[JARVIS voice] ${message}`)
    : undefined;
}

function sanitizePathForLog(value: string | null): string {
  if (!value) return '<missing>';
  const profile = process.env.USERPROFILE;
  const localAppData = process.env.LOCALAPPDATA;
  return value.replace(profile ?? '\0', '%USERPROFILE%').replace(localAppData ?? '\0', '%LOCALAPPDATA%');
}

export interface WhisperResolutionOptions {
  configuredExecutable?: string;
  configuredModel?: string;
  environment?: NodeJS.ProcessEnv;
  localAppData?: string;
  fileExists?: FileExists;
  logger?: Logger;
}

export async function resolveWhisperConfiguration(options: WhisperResolutionOptions = {}): Promise<WhisperResolution> {
  const existsFile = options.fileExists ?? exists;
  const environment = options.environment ?? process.env;
  const localAppData = options.localAppData ?? environment.LOCALAPPDATA ?? path.win32.join(os.homedir(), 'AppData', 'Local');
  const root = path.win32.join(localAppData, 'JARVIS', 'whisper');
  const automaticExecutablePaths = [
    path.win32.join(root, 'whisper-cli.exe'),
    path.win32.join(root, 'Release', 'whisper-cli.exe'),
    path.win32.join(root, 'bin', 'Release', 'whisper-cli.exe')
  ];
  const automaticModelPaths = [
    path.win32.join(root, 'models', 'ggml-tiny.en.bin'),
    path.win32.join(root, 'models', 'ggml-base.en.bin'),
    path.win32.join(root, 'Release', 'models', 'ggml-tiny.en.bin'),
    path.win32.join(root, 'Release', 'models', 'ggml-base.en.bin')
  ];
  const checkedExecutablePaths = [...automaticExecutablePaths];
  const checkedModelPaths = [...automaticModelPaths];
  const log = options.logger ?? developmentLogger();

  async function choose(configured: string | undefined, envValue: string | undefined, automatic: string[], checked: string[]): Promise<{ value: string | null; source: WhisperResolution['executableSource'] }> {
    const configuredPath = absoluteWindowsPath(configured);
    const environmentPath = absoluteWindowsPath(envValue);
    if (configured?.trim() && configuredPath && !checked.includes(configuredPath)) checked.unshift(configuredPath);
    if (envValue?.trim() && environmentPath && !checked.includes(environmentPath)) checked.unshift(environmentPath);
    if (configuredPath && await existsFile(configuredPath)) return { value: configuredPath, source: 'user' };
    if (environmentPath && await existsFile(environmentPath)) return { value: environmentPath, source: 'environment' };
    for (const candidate of automatic) if (await existsFile(candidate)) return { value: candidate, source: 'automatic' };
    return { value: null, source: 'missing' };
  }

  const executable = await choose(options.configuredExecutable, environment.JARVIS_WHISPER_CLI, automaticExecutablePaths, checkedExecutablePaths);
  const model = await choose(options.configuredModel, environment.JARVIS_WHISPER_MODEL, automaticModelPaths, checkedModelPaths);
  log?.(`executable=${sanitizePathForLog(executable.value)} source=${executable.source}; model=${sanitizePathForLog(model.value)} source=${model.source}`);
  return { executable: executable.value, model: model.value, executableSource: executable.source, modelSource: model.source, checkedExecutablePaths, checkedModelPaths };
}

function run(exec: ExecFile, file: string, args: string[], options: Parameters<typeof execFile>[2] = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(file, args, { windowsHide: true, ...options }, (error, stdout, stderr) => {
      if (error) Object.assign(error, { stdout, stderr });
      error ? reject(error) : resolve({ stdout, stderr });
    });
  });
}

export function normalizeTranscription(text: string): string {
  return text.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function processFailureMessage(error: unknown): string {
  const candidate = error as { code?: string | number; message?: string; stderr?: string; stdout?: string };
  const details = `${candidate.stderr ?? ''} ${candidate.stdout ?? ''}`.trim();
  if (candidate.code === 'ENOENT') return 'Unable to launch Whisper. The configured whisper-cli.exe could not be started.';
  if (/model|ggml|failed to load/i.test(details)) return `Whisper model loading failed${details ? `: ${details.split(/\r?\n/)[0].trim()}` : '.'}`;
  return `Whisper transcription failed${details ? `: ${details.split(/\r?\n/)[0].trim()}` : '.'}`;
}

export class WhisperService {
  private readonly exec: ExecFile;
  private readonly config: VoiceConfig;
  private readonly fileExists: FileExists;
  private readonly createTempDirectory: () => Promise<string>;
  private readonly removeDirectory: (directory: string) => Promise<unknown>;
  private readonly logger?: Logger;
  private readonly environment?: NodeJS.ProcessEnv;
  private readonly localAppData?: string;

  constructor(config: VoiceConfig = { speechEnabled: true }, execImplementation: ExecFile = execFile as unknown as ExecFile, dependencies: { fileExists?: FileExists; createTempDirectory?: () => Promise<string>; removeDirectory?: (directory: string) => Promise<unknown>; logger?: Logger; environment?: NodeJS.ProcessEnv; localAppData?: string } = {}) {
    this.config = config; this.exec = execImplementation; this.fileExists = dependencies.fileExists ?? exists; this.createTempDirectory = dependencies.createTempDirectory ?? (() => mkdtemp(path.join(os.tmpdir(), 'jarvis-voice-'))); this.removeDirectory = dependencies.removeDirectory ?? ((directory) => rm(directory, { recursive: true, force: true })); this.logger = dependencies.logger; this.environment = dependencies.environment; this.localAppData = dependencies.localAppData;
  }

  async resolve(): Promise<WhisperResolution> {
    return resolveWhisperConfiguration({ configuredExecutable: this.config.whisperExecutable, configuredModel: this.config.whisperModel, environment: this.environment, localAppData: this.localAppData, fileExists: this.fileExists, logger: this.logger });
  }

  async availability(): Promise<VoiceAvailability> {
    const resolution = await this.resolve();
    return { whisperExecutable: resolution.executable, whisperModel: resolution.model, speechAvailable: process.platform === 'win32', configurationSource: { executable: resolution.executableSource, model: resolution.modelSource } };
  }

  async transcribeWav(audio: Uint8Array): Promise<string> {
    const resolution = await this.resolve();
    if (!resolution.executable) throw new Error(`Whisper executable not found. Checked: ${resolution.checkedExecutablePaths.join('; ')}`);
    if (!resolution.model) throw new Error(`Whisper model not found. Checked: ${resolution.checkedModelPaths.join('; ')}`);
    const tempDirectory = await this.createTempDirectory(); const audioPath = path.join(tempDirectory, 'input.wav');
    try {
      await writeFile(audioPath, audio);
      const result = await run(this.exec, resolution.executable, ['-m', resolution.model, '-f', audioPath, '-nt', '--prompt', this.config.initialPrompt ?? DEFAULT_WHISPER_INITIAL_PROMPT], { maxBuffer: 1024 * 1024, timeout: 120_000 });
      const text = normalizeTranscription(result.stdout);
      if (!text) throw new Error('Whisper returned no speech. Try again closer to the microphone.');
      return text;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Whisper returned')) throw error;
      throw new Error(processFailureMessage(error));
    } finally { await this.removeDirectory(tempDirectory); }
  }
}

