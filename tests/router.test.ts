import { describe, expect, it } from 'vitest';
import { classifyCommand, helpText, normalizeCommandText } from '../src/core/router';

describe('command router', () => {
  it('recognizes direct app commands without AI', () => {
    expect(classifyCommand('Jarvis, open VS Code.')).toMatchObject({ kind: 'launch-app', app: 'vscode' });
    expect(classifyCommand('launch chrome')).toMatchObject({ kind: 'launch-app', app: 'chrome' });
    expect(classifyCommand('Can you open Chrome?')).toMatchObject({ kind: 'launch-app', app: 'chrome' });
    expect(classifyCommand('Open my JARVIS project')).toMatchObject({ kind: 'open-project' });
    expect(classifyCommand('Open Calculator')).toMatchObject({ kind: 'launch-app', app: 'calculator' });
    for (const phrase of ['Open Visual Studio Code.', 'Open V S Code.', 'Can you open VS Code?', 'Launch Visual Studio Code.', 'Jarvis, open Chrome.', 'Can you open Chrome?']) {
      expect(classifyCommand(phrase)).toMatchObject({ kind: 'launch-app' });
    }
  });
  it('recognizes absolute folders only', () => {
    expect(classifyCommand('open C:\\Projects')).toMatchObject({ kind: 'open-folder', path: 'C:\\Projects' });
    expect(classifyCommand('open my downloads')).toMatchObject({ kind: 'unknown' });
  });
  it('handles local utility commands', () => {
    expect(classifyCommand('what is the time?').kind).toBe('time');
    expect(classifyCommand('help').kind).toBe('help');
    expect(helpText()).toContain('Open VS Code');
  });
  it('does not turn arbitrary text into an executable command', () => {
    expect(classifyCommand('run this: del important files').kind).toBe('unknown');
  });
  it('normalizes harmless wording without rewriting unrelated words', () => {
    expect(normalizeCommandText('Jarvis, please open VS Code.')).toBe('open vs code');
    expect(classifyCommand('Open code')).toMatchObject({ kind: 'ambiguous' });
    expect(classifyCommand('Open a random application')).toMatchObject({ kind: 'unknown' });
  });
});
