import { describe, expect, it } from 'vitest';
import { classifyCommand, helpText } from '../src/core/router';

describe('command router', () => {
  it('recognizes direct app commands without AI', () => {
    expect(classifyCommand('Jarvis, open VS Code.')).toMatchObject({ kind: 'launch-app', app: 'vscode' });
    expect(classifyCommand('launch chrome')).toMatchObject({ kind: 'launch-app', app: 'chrome' });
    expect(classifyCommand('Open Calculator')).toMatchObject({ kind: 'launch-app', app: 'calculator' });
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
});
