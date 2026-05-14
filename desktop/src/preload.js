const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('maintrixDesktop', {
  isDesktop: true,
  version: () => ipcRenderer.invoke('get-app-version'),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url),
  getLicenseKey: () => ipcRenderer.invoke('get-license-key'),
  setLicenseKey: (key) => ipcRenderer.invoke('set-license-key', key),
  navigate: (route) => ipcRenderer.invoke('navigate', route),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
