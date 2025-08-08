import type { Express } from "express";
import { createReadStream, existsSync } from "fs";
import { join } from "path";
import archiver from "archiver";
import { Response } from "express";

// Configuration des téléchargements
const DOWNLOADS_CONFIG = {
  installer: {
    filename: "smart-gmao-diagfix-installer.sh",
    path: "scripts/install.sh",
    contentType: "application/x-sh"
  },
  dockerPackage: {
    filename: "smart-gmao-diagfix-docker.tar.gz",
    contentType: "application/gzip"
  },
  source: {
    filename: "smart-gmao-diagfix-source.zip",
    contentType: "application/zip"
  },
  android: {
    filename: "smart-gmao-diagfix.apk",
    path: "mobile/android/app/build/outputs/apk/release/app-release.apk",
    contentType: "application/vnd.android.package-archive"
  },
  quickStart: {
    filename: "guide-demarrage-rapide.md",
    path: "GUIDE_DEMARRAGE_RAPIDE.md",
    contentType: "text/markdown"
  }
};

// Fonction pour créer une archive ZIP du code source
function createSourceArchive(res: Response): void {
  const archive = archiver('zip', {
    zlib: { level: 9 } // Compression maximale
  });

  // Configuration des en-têtes
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="smart-gmao-diagfix-source.zip"');

  // Gestion des erreurs
  archive.on('error', (err: Error) => {
    console.error('Erreur création archive:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'archive' });
  });

  // Pipe vers la réponse
  archive.pipe(res);

  // Ajouter les fichiers et dossiers à l'archive
  const filesToInclude = [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'tailwind.config.ts',
    'postcss.config.js',
    'components.json',
    'drizzle.config.ts',
    '.env.example',
    'README.md',
    'GUIDE_DEMARRAGE_RAPIDE.md',
    'INSTALLATION_LOCALE.md',
    'DOCUMENTATION_COMPLETE_SMART_GMAO_DIAGFIX.md',
    'Dockerfile',
    'docker-compose.yml'
  ];

  const foldersToInclude = [
    'client',
    'server',
    'shared',
    'scripts',
    'mobile'
  ];

  // Ajouter les fichiers individuels
  filesToInclude.forEach(file => {
    if (existsSync(file)) {
      archive.file(file, { name: file });
    }
  });

  // Ajouter les dossiers
  foldersToInclude.forEach(folder => {
    if (existsSync(folder)) {
      archive.directory(folder, folder);
    }
  });

  // Finaliser l'archive
  archive.finalize();
}

// Fonction pour créer le package Docker
function createDockerPackage(res: Response): void {
  const archive = archiver('tar', {
    gzip: true,
    gzipOptions: {
      level: 9
    }
  });

  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', 'attachment; filename="smart-gmao-diagfix-docker.tar.gz"');

  archive.on('error', (err: Error) => {
    console.error('Erreur création package Docker:', err);
    res.status(500).json({ error: 'Erreur lors de la création du package Docker' });
  });

  archive.pipe(res);

  // Fichiers essentiels pour Docker
  const dockerFiles = [
    'Dockerfile',
    'docker-compose.yml',
    '.env.example',
    'package.json',
    'package-lock.json'
  ];

  dockerFiles.forEach(file => {
    if (existsSync(file)) {
      archive.file(file, { name: file });
    }
  });

  // Scripts d'installation et configuration
  if (existsSync('scripts')) {
    archive.directory('scripts', 'scripts');
  }

  // Code source compilé (si disponible)
  if (existsSync('dist')) {
    archive.directory('dist', 'dist');
  } else {
    // Sinon inclure le code source
    archive.directory('client', 'client');
    archive.directory('server', 'server');
    archive.directory('shared', 'shared');
  }

  archive.finalize();
}

// Fonction pour envoyer un fichier simple
function sendFile(res: Response, filepath: string, filename: string, contentType: string): void {
  if (!existsSync(filepath)) {
    res.status(404).json({ error: 'Fichier non trouvé' });
    return;
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', require('fs').statSync(filepath).size);

  const stream = createReadStream(filepath);
  stream.on('error', (err: Error) => {
    console.error('Erreur lecture fichier:', err);
    res.status(500).json({ error: 'Erreur lors de la lecture du fichier' });
  });

  stream.pipe(res);
}

export function registerDownloadRoutes(app: Express): void {
  // Route générique de téléchargement
  app.get("/api/download/:type", async (req, res) => {
    const { type } = req.params;

    try {
      switch (type) {
        case 'installer':
          const installerConfig = DOWNLOADS_CONFIG.installer;
          sendFile(res, installerConfig.path, installerConfig.filename, installerConfig.contentType);
          break;

        case 'docker-package':
          createDockerPackage(res);
          break;

        case 'source':
          createSourceArchive(res);
          break;

        case 'android':
          const androidConfig = DOWNLOADS_CONFIG.android;
          sendFile(res, androidConfig.path, androidConfig.filename, androidConfig.contentType);
          break;

        case 'ios':
          // Redirection vers TestFlight ou App Store
          res.redirect('https://testflight.apple.com/join/votre-code-testflight');
          break;

        case 'quick-start':
          const quickStartConfig = DOWNLOADS_CONFIG.quickStart;
          sendFile(res, quickStartConfig.path, quickStartConfig.filename, quickStartConfig.contentType);
          break;

        default:
          res.status(404).json({ error: 'Type de téléchargement non supporté' });
      }
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  });

  // Route pour obtenir les informations de version
  app.get("/api/download/info", (req, res) => {
    const packageJson = require('../package.json');
    
    res.json({
      version: packageJson.version,
      name: packageJson.name,
      description: packageJson.description,
      lastUpdate: new Date().toISOString(),
      downloads: {
        installer: {
          name: "Installation Automatique",
          description: "Script d'installation one-line pour Ubuntu/Debian",
          size: "2.5 MB",
          platform: "Linux",
          requirements: "Ubuntu 20.04+, sudo access"
        },
        dockerPackage: {
          name: "Package Docker",
          description: "Déploiement containerisé avec Docker Compose",
          size: "450 MB",
          platform: "Docker",
          requirements: "Docker 20.10+, Docker Compose 2.0+"
        },
        source: {
          name: "Code Source",
          description: "Archive complète du code source",
          size: "15 MB",
          platform: "Multiplatform",
          requirements: "Node.js 18+, PostgreSQL 13+"
        },
        android: {
          name: "Application Android",
          description: "Application mobile pour techniciens",
          size: "25 MB",
          platform: "Android",
          requirements: "Android 8.0+ (API 26)"
        }
      },
      checksums: {
        installer: "sha256:abcd1234...",
        dockerPackage: "sha256:efgh5678...",
        source: "sha256:ijkl9012...",
        android: "sha256:mnop3456..."
      }
    });
  });

  // Route pour obtenir les statistiques de téléchargement
  app.get("/api/download/stats", (req, res) => {
    // Dans un vrai système, ces données viendraient d'une base de données
    res.json({
      totalDownloads: 1250,
      downloadsToday: 47,
      popularDownload: "docker-package",
      downloadsByType: {
        installer: 456,
        dockerPackage: 623,
        source: 134,
        android: 37
      },
      downloadsByCountry: {
        "France": 580,
        "Canada": 234,
        "Belgique": 156,
        "Suisse": 123,
        "Autres": 157
      }
    });
  });

  // Route pour vérifier l'intégrité des fichiers
  app.get("/api/download/verify/:type", (req, res) => {
    const { type } = req.params;
    
    // Simulation de vérification d'intégrité
    const checksums = {
      installer: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      dockerPackage: "d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35",
      source: "4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865",
      android: "53a0acfad59379b3e050338bf9f23cfc172ee787fdc993e3c17f1ce9e85ebe6d"
    };

    if (checksums[type as keyof typeof checksums]) {
      res.json({
        file: type,
        algorithm: "SHA256",
        checksum: checksums[type as keyof typeof checksums],
        verified: true,
        lastCheck: new Date().toISOString()
      });
    } else {
      res.status(404).json({ error: 'Type de fichier non trouvé' });
    }
  });
}