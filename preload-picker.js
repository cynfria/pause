const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picker', {
  onInit:     (cb) => ipcRenderer.on('picker-init',    (_, p) => cb(p)),
  onPreview:  (cb) => ipcRenderer.on('picker-preview', (_, p) => cb(p)),
  select: (p) => ipcRenderer.send('picker-select', p),
  choose: ()  => ipcRenderer.send('picker-choose'),
  close:  ()  => ipcRenderer.send('picker-close'),
});
