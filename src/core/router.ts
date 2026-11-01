import type { AppId, CommandIntent } from '../shared/types';

/** Only unambiguous application phrases belong here. Ambiguous phrases are handled explicitly below. */
export const applicationAliases: Readonly<Record<string, AppId>> = {
  'vs code': 'vscode', vscode: 'vscode', 'visual studio code': 'vscode',
  'microsoft visual studio code': 'vscode', 'visual studio code editor': 'vscode',
  'v s code': 'vscode',
  chrome: 'chrome', 'google chrome': 'chrome', 'chrome browser': 'chrome',
  notepad: 'notepad', calculator: 'calculator', calc: 'calculator',
  'file explorer': 'explorer', explorer: 'explorer', terminal: 'terminal', powershell: 'terminal'
};

const ambiguousApplicationPhrases = new Set(['code', 'visual studio', 'microsoft visual studio', 'browser']);

export function normalizeCommandText(raw: string): string {
  let normalized = raw.normalize('NFKC').trim().toLowerCase();
  normalized = normalized.replace(/^[,\s.!?]+|[,\s.!?]+$/g, '');
  normalized = normalized.replace(/^jarvis(?:\s+assistant)?(?:\s*[,!:.?-]?\s*)/, '');
  normalized = normalized.replace(/^(?:can you|could you|would you|will you|please)\s+/, '');
  normalized = normalized.replace(/\s+(?:please|thanks|thank you)[.!?]*$/, '');
  normalized = normalized.replace(/[,.!?;\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  normalized = normalized.replace(/\bv\s+s\s+code\b/g, 'v s code');
  normalized = normalized.replace(/^(?:open|launch|start)\s+the\s+/, (prefix) => prefix.replace(/the\s+$/, ''));
  return normalized;
}

function intent(kind: CommandIntent['kind'], displayText: string, normalizedText: string, extra: Partial<CommandIntent> = {}): CommandIntent {
  return { kind, displayText, normalizedText, ...extra };
}

export function classifyCommand(raw: string): CommandIntent {
  const displayText = raw.trim().replace(/^[,!\.\s]+|[,!\.\s]+$/g, '');
  const normalizedText = normalizeCommandText(displayText);
  if (!normalizedText) return intent('unknown', displayText, normalizedText);
  if (/^(help|what can you do|commands)$/.test(normalizedText)) return intent('help', displayText, normalizedText);
  if (/^(what is )?(the )?time(\s+is it)?$/.test(normalizedText)) return intent('time', displayText, normalizedText);
  if (/^(?:open|launch|start)\s+my\s+jarvis\s+project$/.test(normalizedText)) return intent('open-project', displayText, normalizedText);

  const appMatch = normalizedText.match(/^(?:open|launch|start)\s+(.+)$/);
  if (appMatch) {
    const target = appMatch[1].trim();
    const app = applicationAliases[target];
    if (app) return intent('launch-app', displayText, normalizedText, { app });
    if (ambiguousApplicationPhrases.has(target)) return intent('ambiguous', displayText, normalizedText);
    if (/^[a-zA-Z]:[\\/]/.test(target)) {
      const originalCommand = displayText.replace(/^jarvis[,:]?\s*/i, '').replace(/^(?:can you|could you|would you|will you|please)\s+/i, '');
      const originalTarget = originalCommand.match(/^(?:open|launch|start)\s+(.+?)[.!?]?$/i)?.[1].trim() ?? target;
      return intent('open-folder', displayText, normalizedText, { path: originalTarget });
    }
  }
  const folderMatch = normalizedText.match(/^(?:open|go to)\s+(?:folder\s+)?(.+)$/);
  if (folderMatch && /^[a-zA-Z]:[\\/]/.test(folderMatch[1])) return intent('open-folder', displayText, normalizedText, { path: folderMatch[1] });
  return intent('unknown', displayText, normalizedText);
}

export function helpText(): string {
  return 'Try “Open VS Code”, “Open Chrome”, “Open Notepad”, “Open Calculator”, “Open File Explorer”, “Open Terminal”, “Open C:\\Projects”, or “What is the time?”';
}
