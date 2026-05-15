# Maintrix Desktop (Electron)

Application desktop Windows/macOS/Linux basée sur Electron.

## Prérequis

- Node.js 20+
- npm ou yarn
- Pour Windows : `nsis` (inclus avec electron-builder)

## Développement

```bash
# Depuis le répertoire racine, démarrer le serveur web
npm run dev

# Dans un autre terminal, dans le dossier electron/
cd electron
npm install
NODE_ENV=development npm start
```

## Build de production

### Windows (.EXE + .MSI)
```bash
cd electron
npm run build:win
```
Les installeurs sont générés dans `electron/dist-electron/`.

### macOS (.DMG + .PKG)
```bash
cd electron
npm run build:mac
```

### Linux (.DEB + .RPM + AppImage)
```bash
cd electron
npm run build:linux
```

### Toutes plateformes
```bash
cd electron
npm run build:all
```

## Structure

```
electron/
├── main.js          # Processus principal Electron
├── preload.js       # Script preload (API sécurisée vers le renderer)
├── package.json     # Configuration electron-builder
├── assets/
│   ├── icon.ico     # Icône Windows
│   ├── icon.icns    # Icône macOS
│   ├── icon.png     # Icône Linux
│   └── tray.png     # Icône systray (16x16)
└── dist-electron/   # Installeurs générés (après build)
```

## Fonctionnalités desktop

- Démarre le serveur Node.js intégré au lancement
- Mode hors-ligne partiel (synchronisation automatique)
- Icône dans la barre des tâches (systray) avec accès rapide
- Notifications systèmes (alertes maintenance)
- Menu application natif (File / Navigation / Affichage / Aide)
- Mise à jour automatique via GitHub Releases
- Impression de rapports
- Import de fichiers Excel via dialogue natif

## Variables d'environnement (production)

Configurer dans un fichier `.env` à la racine de l'installation :

```env
DATABASE_URL=postgresql://user:password@localhost:5432/maintrix
SESSION_SECRET=votre-secret-securise
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG....
```
