const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onState: (cb) => ipcRenderer.on('state', (_, data) => cb(data)),
  onBg:    (cb) => ipcRenderer.on('bg', (_, p) => cb(p)),
  snooze:  () => ipcRenderer.send('snooze'),
  reset:   () => ipcRenderer.send('reset'),
  skip:    () => ipcRenderer.send('skip'),
  quit:    () => ipcRenderer.send('quit'),
});
