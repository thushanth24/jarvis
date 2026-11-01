import { classifyCommand, helpText } from '../core/router';
import type { AppId, CommandResult } from '../shared/types';
import { launchApp, openFolder } from './windows';

export interface CommandActions {
  launchApp(app: AppId): Promise<void>;
  openFolder(folderPath: string): Promise<void>;
  projectPath?: string;
}

/** Shared command path for typed input and locally transcribed speech. */
export async function executeCommand(input: string, actions: CommandActions = {
  launchApp,
  openFolder,
  projectPath: process.env.JARVIS_PROJECT_PATH
}): Promise<CommandResult> {
  const intent = classifyCommand(input);
  try {
    if (intent.kind === 'help') return { ok: true, message: helpText(), intent };
    if (intent.kind === 'time') return { ok: true, message: `It is ${new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date())}.`, intent };
    if (intent.kind === 'open-project') {
      if (!actions.projectPath) return { ok: false, message: 'JARVIS_PROJECT_PATH is not configured. Set it to your project folder and restart JARVIS.', intent };
      await actions.openFolder(actions.projectPath);
      return { ok: true, message: 'Opening your JARVIS project.', intent };
    }
    if (intent.kind === 'ambiguous') return { ok: false, message: `I heard “${intent.normalizedText}”. Did you mean VS Code or another application? Please say the full application name.`, intent };
    if (intent.kind === 'launch-app' && intent.app) {
      await actions.launchApp(intent.app);
      return { ok: true, message: `Opening ${intent.app === 'vscode' ? 'VS Code' : intent.app}.`, intent };
    }
    if (intent.kind === 'open-folder' && intent.path) {
      await actions.openFolder(intent.path);
      return { ok: true, message: `Opening ${intent.path}.`, intent };
    }
    return { ok: false, message: 'I do not recognize that command yet. Type “help” to see what I can do.', intent };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'The operation failed.', intent };
  }
}
