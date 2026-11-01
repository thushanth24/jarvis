import { execFile } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import type { AppId } from '../shared/types';

type FileExists = (filePath: string) => Promise<boolean>;
type DirectoryStat = (folderPath: string) => Promise<{ isDirectory(): boolean }>;
type OpenPath = (folderPath: string) => Promise<string>;
type RegistryQuery = (key: string) => Promise<string | null>;
type LaunchExecutable = (executable: string, args?: string[]) => Promise<void>;

export interface WindowsLaunchOptions {
  configuredPath?: string;
  fileExists?: FileExists;
  registryQuery?: RegistryQuery;
  launch?: LaunchExecutable;
  stat?: DirectoryStat;
  openPath?: OpenPath;
}

const knownExecutables: Record<Exclude<AppId, 'chrome'>, string[]> = {
  vscode: ['code.cmd', 'code.exe'], notepad: ['notepad.exe'], calculator: ['calc.exe'],
  explorer: ['explorer.exe'], terminal: ['wt.exe', 'powershell.exe']
};

const chromeRegistryKeys = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe',
  'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe'
];

function launchExecutable(executable: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(executable, args, { windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => resolve());
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try { await access(filePath, constants.F_OK); return true; } catch { return false; }
}

async function queryRegistryDefaultValue(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('reg.exe', ['query', key, '/ve'], { windowsHide: true }, (error, stdout) => {
      if (error) { resolve(null); return; }
      const match = stdout.match(/\(Default\)\s+REG_SZ\s+(.+)$/im);
      resolve(match?.[1].trim() || null);
    });
  });
}

function standardChromePaths(): string[] {
  const roots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA,
    'C:\\Program Files',
    'C:\\Program Files (x86)'
  ].filter((root): root is string => Boolean(root));
  return [...new Set(roots.map((root) => path.win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')))];
}

export interface ChromeDiscoveryOptions {
  configuredPath?: string;
  fileExists?: FileExists;
  registryQuery?: RegistryQuery;
}

export async function findChromeExecutable(options: ChromeDiscoveryOptions = {}): Promise<string | null> {
  const exists = options.fileExists ?? fileExists;
  const configuredPath = options.configuredPath?.trim();
  const candidates = [...(configuredPath ? [configuredPath] : []), ...standardChromePaths()];
  for (const candidate of candidates) if (path.win32.isAbsolute(candidate) && await exists(candidate)) return candidate;

  const queryRegistry = options.registryQuery ?? queryRegistryDefaultValue;
  for (const key of chromeRegistryKeys) {
    const registryPath = await queryRegistry(key);
    if (registryPath && path.win32.isAbsolute(registryPath) && await exists(registryPath)) return registryPath;
  }
  return null;
}

function appLabel(app: AppId): string {
  return app === 'vscode' ? 'VS Code' : app === 'chrome' ? 'Chrome' : app[0].toUpperCase() + app.slice(1);
}

export async function launchApp(app: AppId, options: WindowsLaunchOptions = {}): Promise<void> {
  const launch = options.launch ?? launchExecutable;
  if (app === 'chrome') {
    const chromePath = await findChromeExecutable({
      configuredPath: options.configuredPath ?? process.env.JARVIS_CHROME_PATH,
      fileExists: options.fileExists,
      registryQuery: options.registryQuery
    });
    if (!chromePath) throw new Error('Could not locate Google Chrome. Install Chrome or configure JARVIS_CHROME_PATH with its full chrome.exe path.');
    await launch(chromePath);
    return;
  }

  let lastError: unknown;
  for (const executable of knownExecutables[app]) {
    try { await launch(executable); return; } catch (error) { lastError = error; }
  }
  throw new Error(`Could not find ${appLabel(app)}. Configure it or install it first. ${lastError instanceof Error ? lastError.message : ''}`.trim());
}

function validateWindowsFolderPath(folderPath: string): void {
  if (!/^[a-zA-Z]:[\\/]/.test(folderPath)) throw new Error('Only absolute Windows folder paths are allowed.');
}

async function openWithElectronShell(folderPath: string): Promise<string> {
  const { shell } = await import('electron');
  return shell.openPath(folderPath);
}

export async function openFolder(folderPath: string, options: WindowsLaunchOptions = {}): Promise<void> {
  validateWindowsFolderPath(folderPath);
  const checkStat = options.stat ?? stat;
  try {
    const folderStat = await checkStat(folderPath);
    if (!folderStat.isDirectory()) throw new Error('not-a-directory');
  } catch {
    throw new Error(`Folder not found: ${folderPath}`);
  }

  const result = await (options.openPath ?? openWithElectronShell)(folderPath);
  if (result) throw new Error(`Unable to open folder: ${result}`);
}
