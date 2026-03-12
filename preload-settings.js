const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settings', {
  onInit: (cb) => ipcRenderer.on('settings-init', (_, data) => cb(data)),
  save:   (data) => ipcRenderer.send('settings-save', data),
  close:  ()     => ipcRenderer.send('settings-close'),
});
