# Maintrix Desktop — Application Electron

Application desktop native pour Windows, macOS et Linux basée sur Electron.
Encapsule la webapp Maintrix dans un wrapper natif avec menu, raccourcis clavier, systray, et auto-mises à jour.

## Démarrage rapide

```bash
cd desktop
npm install
npm start          # Mode développement (pointe sur localhost:5000)
```

## Build

```bash
npm run build:win   # .exe NSIS + portable
npm run build:mac   # .dmg + .zip (Intel + Apple Silicon)
npm run build:linux # .AppImage + .deb + .rpm
npm run build:all   # Toutes plateformes
```

## Fonctionnalités

- Fenêtre native avec sauvegarde de taille/position
- Splash screen au démarrage
- Menu applicatif complet (Navigation, Affichage, Serveur, Aide)
- Raccourcis clavier : Cmd/Ctrl+1 à 5 pour les sections principales
- Icône systray avec accès rapide
- Auto-updater (electron-updater via GitHub Releases)
- Instance unique (une seule fenêtre simultanée)
- Configuration URL serveur persistante (local ou cloud)
- Sécurité : navigation restreinte aux domaines Maintrix autorisés

## Configuration serveur

Par défaut pointe sur `http://localhost:5000` (développement local).
Via le menu Serveur → Configurer l'URL, ou raccourcis :
- **Serveur local** : `http://localhost:5000`
- **Cloud Maintrix** : `https://maintrix.replit.app`

## Structure

```
desktop/
├── src/
│   ├── main.js        # Processus principal Electron
│   ├── preload.js     # Bridge sécurisé contextIsolation
│   └── splash.html    # Écran de démarrage animé
├── assets/
│   ├── icon.ico       # Icône Windows
│   ├── icon.icns      # Icône macOS
│   ├── icon.png       # Icône Linux
│   └── tray-icon.png  # Icône systray
├── dist/              # Build de production (généré)
└── package.json       # Config Electron Builder
```
