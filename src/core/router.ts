import type { AppId, CommandIntent } from '../shared/types';

const appNames: Record<string, AppId> = {
  'vs code': 'vscode', vscode: 'vscode', code: 'vscode', chrome: 'chrome',
  'google chrome': 'chrome', notepad: 'notepad', calculator: 'calculator',
  calc: 'calculator', 'file explorer': 'explorer', explorer: 'explorer', terminal: 'terminal',
  powershell: 'terminal'
};

export function classifyCommand(raw: string): CommandIntent {
  const input = raw.trim().replace(/^[,!.\s]+|[,!.\s]+$/g, '');
  const normalized = input.toLowerCase().replace(/^jarvis[,:]?\s*/, '');
  const originalCommand = input.replace(/^jarvis[,:]?\s*/i, '');
  if (!normalized) return { kind: 'unknown', displayText: input };
  if (/^(help|what can you do|commands)$/.test(normalized)) return { kind: 'help', displayText: input };
  if (/^(what is )?(the )?time(\s+is it)?\??$/.test(normalized)) return { kind: 'time', displayText: input };

  const appMatch = normalized.match(/^(?:open|launch|start)\s+(.+?)[.!?]?$/);
  if (appMatch) {
    const target = appMatch[1].trim();
    const app = appNames[target];
    if (app) return { kind: 'launch-app', app, displayText: input };
    if (/^[a-zA-Z]:[\\/]/.test(target)) {
      const originalTarget = originalCommand.match(/^(?:open|launch|start)\s+(.+?)[.!?]?$/i)?.[1].trim() ?? target;
      return { kind: 'open-folder', path: originalTarget, displayText: input };
    }
  }
  const folderMatch = normalized.match(/^(?:open|go to)\s+(?:folder\s+)?(.+?)\s*$/);
  if (folderMatch && /^[a-zA-Z]:[\\/]/.test(folderMatch[1])) return { kind: 'open-folder', path: folderMatch[1], displayText: input };
  return { kind: 'unknown', displayText: input };
}

export function helpText(): string {
  return 'Try “Open VS Code”, “Open Chrome”, “Open Notepad”, “Open Calculator”, “Open File Explorer”, “Open Terminal”, “Open C:\\Projects”, or “What is the time?”';
}
