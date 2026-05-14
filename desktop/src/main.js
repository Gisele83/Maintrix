const { app, BrowserWindow, Menu, shell, dialog, ipcMain, Tray, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const path = require('path');

// ─── Configuration persistante ──────────────────────────────────────────────
const store = new Store({
  schema: {
    serverUrl: { type: 'string', default: 'http://localhost:5000' },
    windowBounds: { type: 'object', default: { width: 1280, height: 800 } },
    isMaximized: { type: 'boolean', default: false },
    licenseKey: { type: 'string', default: '' },
    theme: { type: 'string', default: 'light' },
  },
});

const isDev = process.env.ELECTRON_IS_DEV === '1' || !app.isPackaged;
const SERVER_URL = store.get('serverUrl');

let mainWindow = null;
let tray = null;
let splashWindow = null;

// ─── Splash Screen ────────────────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: { contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

// ─── Fenêtre principale ───────────────────────────────────────────────────
function createMainWindow() {
  const { width, height } = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Maintrix — Supervision Industrielle',
    icon: path.join(__dirname, '../assets/icon.png'),
    backgroundColor: '#f8f9ff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
      allowRunningInsecureContent: isDev,
    },
  });

  // Restaurer la maximisation
  if (store.get('isMaximized')) mainWindow.maximize();

  // Sauvegarder la taille/position à la fermeture
  mainWindow.on('close', () => {
    if (!mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
    store.set('isMaximized', mainWindow.isMaximized());
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Afficher la fenêtre quand prête (après splash)
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
      mainWindow.show();
      if (isDev) mainWindow.webContents.openDevTools();
    }, 1500);
  });

  // Ouvrir les liens externes dans le navigateur
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) { shell.openExternal(url); }
    return { action: 'deny' };
  });

  // Navigation vers la webapp Maintrix
  const startUrl = isDev ? 'http://localhost:5000' : SERVER_URL;
  mainWindow.loadURL(startUrl);

  buildApplicationMenu();
}

// ─── Menu applicatif ─────────────────────────────────────────────────────
function buildApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: 'about' }, { type: 'separator' },
      { label: 'Préférences…', accelerator: 'Cmd+,', click: () => mainWindow?.loadURL(`${SERVER_URL}/settings`) },
      { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' },
    ]}] : []),
    {
      label: 'Navigation',
      submenu: [
        { label: 'Tableau de bord', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.loadURL(`${SERVER_URL}/dashboard`) },
        { label: 'GMAO', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.loadURL(`${SERVER_URL}/gmao-dashboard`) },
        { label: 'Diagnostic IA', accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.loadURL(`${SERVER_URL}/smart-diagnostic`) },
        { label: 'Supervision cognitive', accelerator: 'CmdOrCtrl+4', click: () => mainWindow?.loadURL(`${SERVER_URL}/cognitive-infrastructure`) },
        { label: 'OEE / Performance', accelerator: 'CmdOrCtrl+5', click: () => mainWindow?.loadURL(`${SERVER_URL}/oee`) },
        { type: 'separator' },
        { label: 'Capteurs IoT', click: () => mainWindow?.loadURL(`${SERVER_URL}/sensor-hub`) },
        { label: 'Ordres de travail', click: () => mainWindow?.loadURL(`${SERVER_URL}/work-orders`) },
        { label: 'Gestion des actifs', click: () => mainWindow?.loadURL(`${SERVER_URL}/asset-lifecycle`) },
        { type: 'separator' },
        { label: 'Licences & Abonnement', click: () => mainWindow?.loadURL(`${SERVER_URL}/subscription`) },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Actualiser' },
        { role: 'forceReload', label: 'Forcer l\'actualisation' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Zoom +' },
        { role: 'zoomOut', label: 'Zoom -' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools', label: 'Outils développeur' }] : []),
      ],
    },
    {
      label: 'Serveur',
      submenu: [
        {
          label: 'Configurer l\'URL serveur…',
          click: async () => {
            const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
              type: 'question',
              title: 'URL du serveur Maintrix',
              message: `Serveur actuel : ${store.get('serverUrl')}`,
              detail: 'Modifiez cette URL pour pointer vers votre instance Maintrix (local ou cloud).',
              buttons: ['Annuler', 'Modifier'],
              defaultId: 1,
            });
            if (response === 1) openServerConfig();
          },
        },
        {
          label: 'Utiliser le serveur local (localhost:5000)',
          click: () => {
            store.set('serverUrl', 'http://localhost:5000');
            mainWindow?.loadURL('http://localhost:5000');
          },
        },
        {
          label: 'Utiliser le serveur cloud Maintrix',
          click: () => {
            store.set('serverUrl', 'https://maintrix.replit.app');
            mainWindow?.loadURL('https://maintrix.replit.app');
          },
        },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        { label: 'Documentation', click: () => mainWindow?.loadURL(`${SERVER_URL}/documentation`) },
        { label: 'Guide de démarrage', click: () => shell.openExternal('https://maintrix.app/docs') },
        { type: 'separator' },
        { label: 'Contacter le support', click: () => shell.openExternal('mailto:support@maintrix.app') },
        { label: 'Signaler un problème', click: () => shell.openExternal('https://github.com/maintrix/desktop/issues') },
        { type: 'separator' },
        {
          label: 'À propos de Maintrix Desktop',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Maintrix Desktop',
            message: 'Maintrix — Supervision Industrielle Adaptative',
            detail: `Version : ${app.getVersion()}\nElectron : ${process.versions.electron}\nNode : ${process.versions.node}\nPlateforme : ${process.platform}\n\n© 2025 Maintrix SAS\nArchitecture brevetée à 5 modules`,
            buttons: ['Fermer'],
          }),
        },
        ...(!isMac ? [{ role: 'quit', label: 'Quitter' }] : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Tray (icône zone de notification) ───────────────────────────────────
function createTray() {
  try {
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    tray.setToolTip('Maintrix — Supervision active');

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Ouvrir Maintrix', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      { label: 'Tableau de bord', click: () => { mainWindow?.show(); mainWindow?.loadURL(`${SERVER_URL}/dashboard`); } },
      { label: 'Diagnostic IA', click: () => { mainWindow?.show(); mainWindow?.loadURL(`${SERVER_URL}/smart-diagnostic`); } },
      { type: 'separator' },
      { label: 'Quitter', click: () => app.quit() },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
  } catch {
    // Pas d'icône tray disponible
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────
ipcMain.handle('get-server-url', () => store.get('serverUrl'));
ipcMain.handle('set-server-url', (_, url) => { store.set('serverUrl', url); });
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-license-key', () => store.get('licenseKey'));
ipcMain.handle('set-license-key', (_, key) => { store.set('licenseKey', key); });
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

ipcMain.handle('navigate', (_, route) => {
  mainWindow?.loadURL(`${store.get('serverUrl')}${route}`);
});

// ─── Auto-updater ─────────────────────────────────────────────────────────
function initAutoUpdater() {
  if (isDev) return;
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({ type: 'info', title: 'Mise à jour disponible', message: 'Une nouvelle version de Maintrix est en cours de téléchargement.', buttons: ['OK'] });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Mise à jour prête',
      message: 'Maintrix va redémarrer pour appliquer la mise à jour.',
      buttons: ['Redémarrer maintenant', 'Plus tard'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });
}

// ─── Cycle de vie app ─────────────────────────────────────────────────────
app.whenReady().then(() => {
  createSplashWindow();
  createMainWindow();
  createTray();
  initAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow?.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Empêcher les instances multiples
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Sécurité : bloquer la navigation vers des URLs non autorisées
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const serverHost = new URL(store.get('serverUrl')).hostname;
    const allowed = ['localhost', '127.0.0.1', serverHost, 'maintrix.app', 'maintrix.replit.app'];
    if (!allowed.includes(parsedUrl.hostname)) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
});
