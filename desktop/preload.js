/* eslint-disable @typescript-eslint/no-require-imports -- Electron preload is CommonJS */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vibe', {
  reload: () => ipcRenderer.send('vibe:reload'),
});
