/* eslint-disable @typescript-eslint/no-require-imports -- Electron main process is CommonJS */
'use strict';
const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');

const { createAutoUpdateController } = require('./auto-updater');
const { createUpdateVerifier } = require('./update-verifier');

const APP_ORIGIN = 'https://fitnesss.online';
const APP_URL = APP_ORIGIN + '/dashboard';

let mainWindow = null;
let splash = null;
let updateController = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindows);
}

function createSplash() {
  splash = new BrowserWindow({
    width: 380,
    height: 380,
    frame: false,
    resizable: false,
    transparent: true,
    show: true,
    center: true,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'build', 'icon.ico'),
  });
  splash.loadFile(path.join(__dirname, 'renderer', 'splash.html'));
}

function createWindows() {
  createSplash();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    show: false,
    backgroundColor: '#f6f4ef',
    title: 'Vibe-trainer',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  updateController = createAutoUpdateController({
    app,
    autoUpdater,
    dialog,
    getWindow: () => mainWindow,
    verifyUpdate: createUpdateVerifier({
      publicKeyPath: path.join(__dirname, 'update-public-key.pem'),
    }),
  });
  buildMenu();

  mainWindow.loadURL(APP_URL);

  mainWindow.webContents.on('did-finish-load', revealMain);
  mainWindow.once('ready-to-show', revealMain);

  mainWindow.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    // Ignore aborted sub-resource loads; only handle main-frame hard failures.
    if (!isMainFrame || code === -3) return;
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'offline.html'));
    revealMain();
  });

  // Keep in-app navigation on our origin; send everything else to the OS browser.
  const isExternal = (url) => {
    try { return new URL(url).origin !== APP_ORIGIN; } catch { return true; }
  };
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (isExternal(url)) { e.preventDefault(); shell.openExternal(url); }
  });

  updateController.start();
  mainWindow.on('closed', () => { mainWindow = null; });
}

function revealMain() {
  if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
  if (splash && !splash.isDestroyed()) { splash.destroy(); splash = null; }
}

ipcMain.on('vibe:reload', () => { if (mainWindow) mainWindow.loadURL(APP_URL); });

function buildMenu() {
  const template = [
    {
      label: 'Vibe-trainer',
      submenu: [
        { label: 'Домой', accelerator: 'Alt+Home', click: () => mainWindow && mainWindow.loadURL(APP_URL) },
        { label: 'Обновить', role: 'reload' },
        { label: 'Проверить обновления', click: () => updateController && void updateController.checkNow({ manual: true }) },
        { type: 'separator' },
        { label: 'Открыть в браузере', click: () => shell.openExternal(APP_URL) },
        { type: 'separator' },
        { label: 'Выход', role: 'quit' },
      ],
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' }, { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' }, { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' }, { role: 'selectAll', label: 'Выделить всё' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'resetZoom', label: 'Масштаб 100%' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полный экран' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindows(); });
app.on('before-quit', () => { if (updateController) updateController.dispose(); });
