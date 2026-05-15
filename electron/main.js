const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const fs = require('fs');

// ── Configuration ──────────────────────────────────────────────────────────────
const APP_NAME = 'Maintrix';
const APP_VERSION = '2.6.0';
const SERVER_PORT = 5000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const DEV_MODE = process.env.NODE_ENV === 'development';
const USER_DATA_DIR = app.getPath('userData');
const LOG_FILE = path.join(USER_DATA_DIR, 'maintrix.log');

let mainWindow = null;
let tray = null;
let backendProcess = null;
let isQuitting = false;

// ── Logger ─────────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
}

// ── Start embedded backend ─────────────────────────────────────────────────────
function startBackend() {
  if (DEV_MODE) {
    log('DEV MODE — expecting external server on port 5000');
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const serverPath = path.join(process.resourcesPath, 'server', 'index.ts');
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(SERVER_PORT),
      ELECTRON_RUN: '1',
      DATABASE_URL: `sqlite:${path.join(USER_DATA_DIR, 'maintrix.db')}`,
    };
    backendProcess = spawn('node', [serverPath], { env, stdio: 'pipe' });
    backendProcess.stdout.on('data', d => log(`[SERVER] ${d.toString().trim()}`));
    backendProcess.stderr.on('data', d => log(`[SERVER ERR] ${d.toString().trim()}`));
    backendProcess.on('exit', code => {
      log(`Backend exited with code ${code}`);
      if (!isQuitting) showError('Le serveur Maintrix s\'est arrêté de manière inattendue.');
    });
    // Poll until ready
    const poll = (attempts = 0) => {
      if (attempts > 30) return reject(new Error('Server failed to start'));
      http.get(`${SERVER_URL}/api/health`, (r) => {
        if (r.statusCode < 500) resolve();
        else setTimeout(() => poll(attempts + 1), 1000);
      }).on('error', () => setTimeout(() => poll(attempts + 1), 1000));
    };
    setTimeout(() => poll(), 2000);
  });
}

// ── Create main window ─────────────────────────────────────────────────────────
function createMainWindow() {
  const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 700,
    title: APP_NAME,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
    backgroundColor: '#0f172a',
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (DEV_MODE) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── System Tray ────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);

  const menu = Menu.buildFromTemplate([
    { label: `${APP_NAME} v${APP_VERSION}`, enabled: false },
    { type: 'separator' },
    { label: 'Afficher', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Tableau de bord', click: () => { mainWindow?.show(); mainWindow?.loadURL(`${SERVER_URL}/dashboard`); } },
    { label: 'GMAO', click: () => { mainWindow?.show(); mainWindow?.loadURL(`${SERVER_URL}/gmao`); } },
    { label: 'Diagnostic IA', click: () => { mainWindow?.show(); mainWindow?.loadURL(`${SERVER_URL}/smart-diagnostic`); } },
    { type: 'separator' },
    { label: 'Ouvrir les logs', click: () => shell.openPath(LOG_FILE) },
    { type: 'separator' },
    { label: 'Quitter', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ── Application Menu ───────────────────────────────────────────────────────────
function buildAppMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        { label: 'Accueil', click: () => mainWindow?.loadURL(SERVER_URL) },
        { type: 'separator' },
        { label: 'Quitter', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } },
      ],
    },
    {
      label: 'Navigation',
      submenu: [
        { label: 'Tableau de bord', click: () => mainWindow?.loadURL(`${SERVER_URL}/dashboard`) },
        { label: 'GMAO', click: () => mainWindow?.loadURL(`${SERVER_URL}/gmao`) },
        { label: 'Diagnostic IA', click: () => mainWindow?.loadURL(`${SERVER_URL}/smart-diagnostic`) },
        { label: 'OEE', click: () => mainWindow?.loadURL(`${SERVER_URL}/oee`) },
        { label: 'RCA', click: () => mainWindow?.loadURL(`${SERVER_URL}/rca`) },
        { label: 'Actifs', click: () => mainWindow?.loadURL(`${SERVER_URL}/asset-lifecycle`) },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'forceReload', label: 'Forcer le rechargement' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Zoom +' },
        { role: 'zoomOut', label: 'Zoom -' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        { label: 'Documentation', click: () => shell.openExternal('https://docs.maintrix.io') },
        { label: 'Assistance', click: () => shell.openExternal('https://support.maintrix.io') },
        { type: 'separator' },
        { label: 'Voir les logs', click: () => shell.openPath(LOG_FILE) },
        { label: `À propos de ${APP_NAME}`, click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: `À propos de ${APP_NAME}`,
            message: `${APP_NAME} v${APP_VERSION}`,
            detail: `Plateforme industrielle intelligente de supervision et GMAO.\n\nNode.js ${process.version}\nElectron ${process.versions.electron}\nOS: ${os.type()} ${os.release()}`,
            buttons: ['OK'],
          });
        }},
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Error helper ───────────────────────────────────────────────────────────────
function showError(msg) {
  dialog.showErrorBox(`${APP_NAME} — Erreur`, msg);
}

// ── IPC handlers ───────────────────────────────────────────────────────────────
ipcMain.handle('get-app-info', () => ({
  version: APP_VERSION,
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  electronVersion: process.versions.electron,
  userDataDir: USER_DATA_DIR,
}));

ipcMain.handle('show-notification', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
  });
  return result.filePaths[0] || null;
});

// ── App lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  log(`Starting ${APP_NAME} v${APP_VERSION}`);
  buildAppMenu();
  try {
    await startBackend();
    log('Backend ready');
  } catch (e) {
    log(`Backend start error: ${e.message}`);
    if (!DEV_MODE) showError('Impossible de démarrer le serveur Maintrix.');
  }
  createMainWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray on Windows/Linux
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  else mainWindow?.show();
});

app.on('before-quit', () => { isQuitting = true; });

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    log('Backend process terminated');
  }
});

// ── Auto-updater (stub) ────────────────────────────────────────────────────────
function checkForUpdates() {
  http.get('https://api.maintrix.io/version', (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try {
        const { version } = JSON.parse(data);
        if (version !== APP_VERSION) {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Mise à jour disponible',
            message: `La version ${version} est disponible.`,
            buttons: ['Télécharger', 'Plus tard'],
          }).then(({ response }) => {
            if (response === 0) shell.openExternal('https://maintrix.io/download');
          });
        }
      } catch {}
    });
  }).on('error', () => {});
}

app.whenReady().then(() => setTimeout(checkForUpdates, 10000));
