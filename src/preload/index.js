const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  onGlobalMouse: (callback) => ipcRenderer.on('global-mouse', (_event, value) => callback(value)),
  closeWindow: () => ipcRenderer.send('window-close'),
  minimizeWindow: () => ipcRenderer.send('window-minimize')
})