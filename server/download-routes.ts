import type { Express, Response } from "express";
import { createReadStream, existsSync, statSync } from "fs";
import { join } from "path";
import archiver from "archiver";

// Configuration des téléchargements
const DOWNLOADS_CONFIG = {
  installer: {
    filename: "smart-gmao-diagfix-installer.sh",
    path: "scripts/install.sh",
    contentType: "application/x-sh"
  },
  quickStart: {
    filename: "guide-demarrage-rapide.md",
    path: "GUIDE_DEMARRAGE_RAPIDE.md",
    contentType: "text/markdown"
  },
  documentation: {
    filename: "documentation-complete.md",
    path: "DOCUMENTATION_COMPLETE_SMART_GMAO_DIAGFIX.md",
    contentType: "text/markdown"
  }
};

// Fonction simplifiée pour envoyer un fichier
function sendFile(res: Response, filepath: string, filename: string, contentType: string): void {
  if (!existsSync(filepath)) {
    res.status(404).json({ error: 'Fichier non trouvé: ' + filepath });
    return;
  }

  try {
    const stats = statSync(filepath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);

    const stream = createReadStream(filepath);
    stream.on('error', (err: Error) => {
      console.error('Erreur lecture fichier:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erreur lors de la lecture du fichier' });
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error('Erreur sendFile:', error);
    res.status(500).json({ error: 'Erreur lors de l\'accès au fichier' });
  }
}

// Fonction pour créer une archive ZIP du code source
function createSourceArchive(res: Response): void {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="smart-gmao-diagfix-source.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });
  
  archive.on('error', (err: Error) => {
    console.error('Erreur archivage:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'archive' });
  });

  archive.pipe(res);

  // Ajouter les fichiers essentiels
  const filesToAdd = [
    'package.json',
    'package-lock.json',
    '.env.example',
    'README.md',
    'GUIDE_DEMARRAGE_RAPIDE.md',
    'INSTALLATION_LOCALE.md'
  ];

  filesToAdd.forEach(file => {
    if (existsSync(file)) {
      archive.file(file, { name: file });
    }
  });

  // Ajouter les répertoires
  const dirsToAdd = ['client', 'server', 'shared', 'scripts', 'mobile'];
  dirsToAdd.forEach(dir => {
    if (existsSync(dir)) {
      archive.directory(dir, dir);
    }
  });

  archive.finalize();
}

// Fonction pour créer le package Docker
function createDockerPackage(res: Response): void {
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', 'attachment; filename="smart-gmao-diagfix-docker.tar.gz"');

  const archive = archiver('tar', {
    gzip: true,
    gzipOptions: { level: 9 }
  });

  archive.on('error', (err: Error) => {
    console.error('Erreur archivage Docker:', err);
    res.status(500).json({ error: 'Erreur lors de la création du package Docker' });
  });

  archive.pipe(res);

  // Fichiers Docker essentiels
  const dockerFiles = [
    'Dockerfile',
    'docker-compose.yml',
    '.env.example'
  ];

  dockerFiles.forEach(file => {
    if (existsSync(file)) {
      archive.file(file, { name: file });
    }
  });

  // Scripts d'installation
  if (existsSync('scripts')) {
    archive.directory('scripts', 'scripts');
  }

  // Code source compilé (si disponible)
  if (existsSync('dist')) {
    archive.directory('dist', 'dist');
  }

  archive.finalize();
}

export function registerDownloadRoutes(app: Express): void {
  // Routes spécifiques de téléchargement
  app.get("/api/download/installer", (req, res) => {
    const installerConfig = DOWNLOADS_CONFIG.installer;
    sendFile(res, installerConfig.path, installerConfig.filename, installerConfig.contentType);
  });

  app.get("/api/download/docker-package", (req, res) => {
    createDockerPackage(res);
  });

  app.get("/api/download/source", (req, res) => {
    createSourceArchive(res);
  });

  app.get("/api/download/quick-start", (req, res) => {
    const quickStartConfig = DOWNLOADS_CONFIG.quickStart;
    sendFile(res, quickStartConfig.path, quickStartConfig.filename, quickStartConfig.contentType);
  });

  app.get("/api/download/documentation", (req, res) => {
    const docConfig = DOWNLOADS_CONFIG.documentation;
    sendFile(res, docConfig.path, docConfig.filename, docConfig.contentType);
  });

  // Route pour obtenir les informations de version
  app.get("/api/download/info", (req, res) => {
    const packageInfo = { 
      name: 'Smart GMAO DiagFix', 
      version: '2.1.0',
      description: 'Plateforme de maintenance industrielle intelligente'
    };
    
    res.json({
      version: packageInfo.version,
      name: packageInfo.name,
      description: packageInfo.description,
      buildDate: new Date().toISOString(),
      downloads: {
        installer: {
          filename: DOWNLOADS_CONFIG.installer.filename,
          description: "Script d'installation automatique pour Ubuntu/Debian",
          requirements: "Ubuntu 20.04+, sudo access"
        },
        dockerPackage: {
          filename: "smart-gmao-diagfix-docker.tar.gz",
          description: "Package Docker Compose complet",
          requirements: "Docker 20.10+, Docker Compose 2.0+"
        },
        source: {
          filename: "smart-gmao-diagfix-source.zip",
          description: "Code source complet avec documentation",
          requirements: "Node.js 18+, PostgreSQL 13+"
        },
        quickStart: {
          filename: DOWNLOADS_CONFIG.quickStart.filename,
          description: "Guide de démarrage rapide",
          requirements: "Aucun"
        }
      }
    });
  });

  // Route de test des téléchargements
  app.get("/api/download/test", (req, res) => {
    const testResults = {
      installer: existsSync(DOWNLOADS_CONFIG.installer.path),
      quickStart: existsSync(DOWNLOADS_CONFIG.quickStart.path),
      documentation: existsSync(DOWNLOADS_CONFIG.documentation.path),
      scriptsDir: existsSync('scripts'),
      clientDir: existsSync('client'),
      serverDir: existsSync('server')
    };

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      filesAvailable: testResults,
      allFilesReady: Object.values(testResults).every(Boolean)
    });
  });
}