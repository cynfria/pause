const { app, Tray, Menu, Notification, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const { spawn } = require('child_process');

// Menubar app — no Dock icon
app.dock.hide();

// ── Config ────────────────────────────────────────────────────────────────────
let bgImagePath = null;

function configPath() { return path.join(app.getPath('userData'), 'config.json'); }

function loadConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    bgImagePath  = c.bgImagePath  || null;
    intervalMin  = c.intervalMin  || 20;
    durationSec  = c.durationSec  || 20;
  } catch {}
}

function saveConfig() {
  fs.writeFileSync(configPath(), JSON.stringify({ bgImagePath, intervalMin, durationSec }), 'utf8');
}

function sendBg() {
  if (breakWin && !breakWin.isDestroyed()) breakWin.webContents.send('bg', bgImagePath);
}

// ── Timer constants ──────────────────────────────────────────────────────────
let intervalMin = 20;
let durationSec = 20;
const SNOOZE_SEC = 5 * 60;

function EYE_INTERVAL_SEC() { return intervalMin * 60; }
function EYE_REST_SEC()     { return durationSec; }

// ── Timer state ──────────────────────────────────────────────────────────────
let state        = 'idle';
let remaining    = EYE_INTERVAL_SEC();
let tickInterval = null;

let tray           = null;
let breakWin       = null;  // eye break popup
let bgPickerWin    = null;  // bg picker modal
let settingsWin    = null;  // settings modal

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function notify(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
}

function getTotal() {
  return state === 'rest' ? EYE_REST_SEC()
       : state === 'snoozed' ? SNOOZE_SEC
       : EYE_INTERVAL_SEC();
}

function sendState() {
  const payload = { eyeState: state, eyeRemaining: remaining, eyeTotal: getTotal() };
  if (breakWin && !breakWin.isDestroyed()) breakWin.webContents.send('state', payload);
}

function rebuildMenu() {
  const label =
    state === 'rest'    ? `Look away! ${fmt(remaining)}` :
    state === 'snoozed' ? `💤 Snoozed — ${fmt(remaining)}` :
                          `Next break in ${fmt(remaining)}`;

  tray.setContextMenu(Menu.buildFromTemplate([
    { label, enabled: false },
    { type: 'separator' },
    { label: 'Snooze 5 min', enabled: state !== 'rest', click: snooze },
    { label: 'Reset timer', click: reset },
    { type: 'separator' },
    { label: 'Change background…', click: openBgPicker },
    { label: 'Settings…',          click: openSettings },
    { type: 'separator' },
    { label: 'Quit', accelerator: 'Command+Q', click: () => app.quit() },
  ]));
}

function updateTray() {
  const title =
    state === 'rest'    ? fmt(remaining) :
    state === 'snoozed' ? `💤 ${fmt(remaining)}` :
                          fmt(remaining);
  tray.setTitle(title);
  rebuildMenu();
  sendState();
}

// ── Timer actions ─────────────────────────────────────────────────────────────
function startIdle() {
  state     = 'idle';
  remaining = EYE_INTERVAL_SEC();
  updateTray();
}

function startRest() {
  state     = 'rest';
  remaining = EYE_REST_SEC();
  notify('Time for an eye break!', 'Look 20 feet away for 20 seconds.');
  createBreakWindow(() => {
    breakWin.show();
    breakWin.focus();
    sendState();
  });
  updateTray();
}

function snooze() {
  state     = 'snoozed';
  remaining = SNOOZE_SEC;
  updateTray();
}

function reset() {
  startIdle();
}

// ── Main tick ─────────────────────────────────────────────────────────────────
function tick() {
  remaining -= 1;

  if (remaining <= 0) {
    if (state === 'idle' || state === 'snoozed') {
      startRest();
    } else if (state === 'rest') {
      if (breakWin && !breakWin.isDestroyed()) breakWin.close();
      spawn('afplay', [path.join(__dirname, 'assets', 'complete.mp3')]);
      notify('Eye break done!', 'Great job. Timer reset to 20 minutes.');
      startIdle();
    }
  } else {
    updateTray();
  }
}

// ── Break popup window ────────────────────────────────────────────────────────
function createBreakWindow(onReady) {
  if (breakWin && !breakWin.isDestroyed()) breakWin.close();

  const trayBounds = tray.getBounds();
  const winWidth   = 360;
  const winHeight  = 380;
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - winWidth / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 8);

  breakWin = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  breakWin.loadFile(path.join(__dirname, 'renderer', 'break.html'));
  breakWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  breakWin.setAlwaysOnTop(true, 'screen-saver');
  breakWin.webContents.once('did-finish-load', () => {
    sendBg();
    if (onReady) onReady();
  });
  breakWin.on('closed', () => { breakWin = null; });
}

// ── Background picker window ──────────────────────────────────────────────────
function openBgPicker() {
  if (bgPickerWin && !bgPickerWin.isDestroyed()) {
    bgPickerWin.focus();
    return;
  }

  bgPickerWin = new BrowserWindow({
    width: 360,
    height: 540,
    resizable: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-picker.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  bgPickerWin.loadFile(path.join(__dirname, 'renderer', 'bg-picker.html'));
  bgPickerWin.webContents.on('did-finish-load', () => {
    bgPickerWin.webContents.send('picker-init', bgImagePath);
  });
  bgPickerWin.on('closed', () => { bgPickerWin = null; });
}

// ── Settings window ───────────────────────────────────────────────────────────
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }

  settingsWin = new BrowserWindow({
    width: 320,
    height: 220,
    resizable: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWin.webContents.on('did-finish-load', () => {
    settingsWin.webContents.send('settings-init', { intervalMin, durationSec });
  });
  settingsWin.on('closed', () => { settingsWin = null; });
}

// ── App ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  const { nativeImage } = require('electron');
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Pause');

  loadConfig();

  tray.on('click', () => tray.popUpContextMenu());

  ipcMain.on('picker-select', (_, p) => {
    bgImagePath = p;
    saveConfig();
    sendBg();
    if (bgPickerWin && !bgPickerWin.isDestroyed()) {
      bgPickerWin.webContents.send('picker-preview', p);
    }
  });

  ipcMain.on('picker-choose', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (filePaths[0]) {
      bgImagePath = filePaths[0];
      saveConfig();
      sendBg();
      if (bgPickerWin && !bgPickerWin.isDestroyed()) {
        bgPickerWin.webContents.send('picker-preview', filePaths[0]);
      }
    }
    if (bgPickerWin && !bgPickerWin.isDestroyed()) bgPickerWin.focus();
  });

  ipcMain.on('picker-close', () => {
    if (bgPickerWin && !bgPickerWin.isDestroyed()) bgPickerWin.close();
  });

  ipcMain.on('settings-close', () => {
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close();
  });

  ipcMain.on('settings-save', (_, { intervalMin: m, durationSec: s }) => {
    intervalMin = m;
    durationSec = s;
    saveConfig();
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close();
    // Reset the idle timer so new interval takes effect immediately
    if (state === 'idle' || state === 'snoozed') startIdle();
  });

  ipcMain.on('get-app-path', (e) => { e.returnValue = __dirname; });

  ipcMain.on('snooze', snooze);
  ipcMain.on('reset',  reset);
  ipcMain.on('skip',   () => { if (breakWin && !breakWin.isDestroyed()) breakWin.close(); startIdle(); });
  ipcMain.on('quit',   () => app.quit());

  startIdle();
  tickInterval = setInterval(tick, 1000);
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  if (tickInterval) clearInterval(tickInterval);
});
