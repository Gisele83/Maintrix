const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  platform: process.platform,
  isElectron: true,
});
