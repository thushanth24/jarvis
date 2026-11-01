import { contextBridge, ipcRenderer } from 'electron';
import type { JarvisApi } from '../shared/types';

const api: JarvisApi = {
  executeCommand: (input) => ipcRenderer.invoke('command:execute', input),
  toggleWindow: () => ipcRenderer.invoke('window:toggle'),
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  transcribeWav: (audio) => ipcRenderer.invoke('voice:transcribe', audio),
  speak: (text, voiceName) => ipcRenderer.invoke('voice:speak', text, voiceName),
  stopSpeaking: () => ipcRenderer.invoke('voice:stop-speaking'),
  getVoiceAvailability: () => ipcRenderer.invoke('voice:availability'),
  onRecordingCancel: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('voice:cancel-recording', listener);
    return () => ipcRenderer.removeListener('voice:cancel-recording', listener);
  }
};
contextBridge.exposeInMainWorld('jarvis', api);
