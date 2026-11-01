import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron';
import path from 'node:path';
import { COMMAND_PROTOCOL_VERSION } from '../shared/types';
import { executeCommand } from './command';
import { WhisperService } from './voice';
import { WindowsSpeechService } from './speech';

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
// Resolve Whisper lazily inside the service so development restarts and fresh environment values are not captured at module load.
const whisper = new WhisperService({ speechEnabled: true });
const speech = new WindowsSpeechService();
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function createWindow() {
  window = new BrowserWindow({ width: 1080, height: 720, minWidth: 760, minHeight: 560, show: false,
    backgroundColor: '#07111f', webPreferences: { preload: path.join(__dirname, '../preload/preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false } });
  window.once('ready-to-show', () => window?.show());
  window.on('close', (event) => { if (!isQuitting) { event.preventDefault(); window?.hide(); } });
  window.on('hide', () => window?.webContents.send('voice:cancel-recording'));
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

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => { window?.show(); window?.focus(); });
  app.whenReady().then(() => {
    createWindow(); createTray();
    ipcMain.handle('command:execute', (_event, input: unknown) => typeof input === 'string' ? executeCommand(input) : Promise.resolve({ ok: false, message: 'Invalid command.', intent: { kind: 'unknown', displayText: '', normalizedText: '' } }));
    ipcMain.handle('window:toggle', () => { if (window?.isVisible()) window.hide(); else { window?.show(); window?.focus(); } });
    ipcMain.handle('system:info', () => ({ platform: process.platform, version: app.getVersion(), commandProtocol: COMMAND_PROTOCOL_VERSION }));
    ipcMain.handle('voice:availability', async () => ({ ...await whisper.availability(), speechAvailable: await speech.available() }));
    ipcMain.handle('voice:transcribe', async (_event, audio: unknown) => {
      if (!(audio instanceof ArrayBuffer) && !ArrayBuffer.isView(audio)) throw new Error('Invalid voice recording.');
      const bytes = audio instanceof ArrayBuffer ? new Uint8Array(audio) : new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength);
      return { text: await whisper.transcribeWav(bytes) };
    });
    ipcMain.handle('voice:speak', (_event, text: unknown, voiceName: unknown) => {
      if (typeof text !== 'string') throw new Error('Invalid speech text.');
      return speech.speak(text, typeof voiceName === 'string' ? voiceName : undefined);
    });
    ipcMain.handle('voice:stop-speaking', () => speech.stop());
    if (!globalShortcut.register('CommandOrControl+Shift+J', () => { if (window?.isVisible()) window.hide(); else { window?.show(); window?.focus(); } })) console.warn('Global shortcut Ctrl+Shift+J is unavailable.');
  });
}

app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });
app.on('will-quit', () => { window?.webContents.send('voice:cancel-recording'); speech.stop(); });
app.on('window-all-closed', () => { /* tray app intentionally stays alive */ });
