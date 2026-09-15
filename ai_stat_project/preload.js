const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  openCsv: () => ipcRenderer.invoke('csv:open'),
  saveCsv: (payload) => ipcRenderer.invoke('csv:save', payload),
  saveReport: (payload) => ipcRenderer.invoke('report:save', payload)
});
