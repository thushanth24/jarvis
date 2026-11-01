export type AppId = 'vscode' | 'chrome' | 'notepad' | 'calculator' | 'explorer' | 'terminal';
export const COMMAND_PROTOCOL_VERSION = 3;
export type CommandKind = 'launch-app' | 'open-folder' | 'open-project' | 'ambiguous' | 'help' | 'time' | 'unknown';

export interface CommandIntent {
  kind: CommandKind;
  app?: AppId;
  path?: string;
  displayText: string;
  normalizedText: string;
}

export interface CommandResult {
  ok: boolean;
  message: string;
  intent: CommandIntent;
}

export interface JarvisApi {
  executeCommand(input: string): Promise<CommandResult>;
  toggleWindow(): Promise<void>;
  getSystemInfo(): Promise<{ platform: string; version: string; commandProtocol: number }>;
  transcribeWav(audio: ArrayBuffer): Promise<{ text: string }>;
  speak(text: string, voiceName?: string): Promise<'completed' | 'cancelled'>;
  stopSpeaking(): Promise<boolean>;
  getVoiceAvailability(): Promise<{ whisperExecutable: string | null; whisperModel: string | null; speechAvailable: boolean }>;
  onRecordingCancel(callback: () => void): () => void;
}
