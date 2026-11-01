export type AppId = 'vscode' | 'chrome' | 'notepad' | 'calculator' | 'explorer' | 'terminal';
export type CommandKind = 'launch-app' | 'open-folder' | 'help' | 'time' | 'unknown';

export interface CommandIntent {
  kind: CommandKind;
  app?: AppId;
  path?: string;
  displayText: string;
}

export interface CommandResult {
  ok: boolean;
  message: string;
  intent: CommandIntent;
}

export interface JarvisApi {
  executeCommand(input: string): Promise<CommandResult>;
  toggleWindow(): Promise<void>;
  getSystemInfo(): Promise<{ platform: string; version: string }>;
}
