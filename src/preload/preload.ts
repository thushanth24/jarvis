import { contextBridge, ipcRenderer } from 'electron';
import type { JarvisApi } from '../shared/types';

const api: JarvisApi = {
  executeCommand: (input) => ipcRenderer.invoke('command:execute', input),
  toggleWindow: () => ipcRenderer.invoke('window:toggle'),
  getSystemInfo: () => ipcRenderer.invoke('system:info')
};
contextBridge.exposeInMainWorld('jarvis', api);
