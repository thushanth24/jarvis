import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron';
import path from 'node:path';
import { classifyCommand, helpText } from '../core/router';
import { launchApp, openFolder } from './windows';
import type { CommandResult } from '../shared/types';

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function createWindow() {
  window = new BrowserWindow({ width: 1080, height: 720, minWidth: 760, minHeight: 560, show: false,
    backgroundColor: '#07111f', webPreferences: { preload: path.join(__dirname, '../preload/preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  window.once('ready-to-show', () => window?.show());
  window.on('close', (event) => { if (!isQuitting) { event.preventDefault(); window?.hide(); } });
  if (isDev) void window.loadURL(process.env.VITE_DEV_SERVER_URL!);
  else void window.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('JARVIS');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show JARVIS', click: () => { window?.show(); window?.focus(); } },
    { type: 'separator' }, { label: 'Quit', click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on('double-click', () => { window?.show(); window?.focus(); });
}

async function handleCommand(input: string): Promise<CommandResult> {
  const intent = classifyCommand(input);
  try {
    if (intent.kind === 'help') return { ok: true, message: helpText(), intent };
    if (intent.kind === 'time') return { ok: true, message: `It is ${new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date())}.`, intent };
    if (intent.kind === 'launch-app' && intent.app) { await launchApp(intent.app); return { ok: true, message: `Opening ${intent.app === 'vscode' ? 'VS Code' : intent.app}.`, intent }; }
    if (intent.kind === 'open-folder' && intent.path) { await openFolder(intent.path); return { ok: true, message: `Opening ${intent.path}.`, intent }; }
    return { ok: false, message: 'I do not recognize that command yet. Type “help” to see what I can do.', intent };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'The operation failed.', intent }; }
}

app.whenReady().then(() => {
  createWindow(); createTray();
  ipcMain.handle('command:execute', (_event, input: unknown) => typeof input === 'string' ? handleCommand(input) : Promise.resolve({ ok: false, message: 'Invalid command.', intent: { kind: 'unknown', displayText: '' } }));
  ipcMain.handle('window:toggle', () => { if (window?.isVisible()) window.hide(); else { window?.show(); window?.focus(); } });
  ipcMain.handle('system:info', () => ({ platform: process.platform, version: app.getVersion() }));
  if (!globalShortcut.register('CommandOrControl+Shift+J', () => { if (window?.isVisible()) window.hide(); else { window?.show(); window?.focus(); } })) console.warn('Global shortcut Ctrl+Shift+J is unavailable.');
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });
app.on('window-all-closed', () => { /* tray app intentionally stays alive */ });
