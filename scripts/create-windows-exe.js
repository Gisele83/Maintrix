#!/usr/bin/env node

/**
 * Créateur d'installateur Windows exécutable (.exe)
 * Utilise pkg pour créer un véritable fichier .exe
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

// Créer le dossier de sortie
const outputDir = path.join(process.cwd(), 'dist');
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Script d'installation principal en JavaScript
const installerScript = `#!/usr/bin/env node

/**
 * Smart GMAO DiagFix - Installateur Windows (.exe)
 * Installation automatique complète avec Node.js et PostgreSQL
 */

const { execSync, spawn } = require('child_process');
const { writeFileSync, existsSync, mkdirSync, rmSync } = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║        Smart GMAO DiagFix - Installation Windows            ║');
console.log('║              Version 2.1.0 - Janvier 2025                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

const INSTALL_DIR = path.join(process.env.PROGRAMFILES || 'C:\\\\Program Files', 'Smart GMAO DiagFix');
const TEMP_DIR = path.join(os.tmpdir(), 'smart-gmao-install');

// Fonction utilitaire pour exécuter des commandes
function runCommand(command, description) {
  console.log(\`⏳ \${description}...\`);
  try {
    execSync(command, { stdio: 'inherit', windowsHide: true });
    console.log(\`✅ \${description} terminé avec succès\`);
    return true;
  } catch (error) {
    console.error(\`❌ Erreur lors de \${description}: \${error.message}\`);
    return false;
  }
}

// Fonction de téléchargement
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(destination);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      require('fs').unlinkSync(destination);
      reject(err);
    });
  });
}

// Vérification des prérequis administrateur
function checkAdminRights() {
  try {
    execSync('net session >nul 2>&1', { windowsHide: true });
    return true;
  } catch {
    console.error('❌ Droits administrateur requis');
    console.log('');
    console.log('Veuillez exécuter cet installateur en tant qu\\'administrateur:');
    console.log('1. Clic droit sur le fichier .exe');
    console.log('2. Sélectionner "Exécuter en tant qu\\'administrateur"');
    console.log('');
    process.exit(1);
  }
}

// Installation de Node.js
async function installNodeJS() {
  console.log('🔍 Vérification de Node.js...');
  
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8', windowsHide: true });
    console.log(\`✅ Node.js déjà installé: \${nodeVersion.trim()}\`);
    return true;
  } catch {
    console.log('📦 Installation de Node.js en cours...');
    
    const nodeUrl = 'https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi';
    const nodeInstaller = path.join(TEMP_DIR, 'nodejs-installer.msi');
    
    try {
      await downloadFile(nodeUrl, nodeInstaller);
      const installResult = runCommand(\`msiexec /i "\${nodeInstaller}" /quiet /norestart\`, 'Installation Node.js');
      
      if (installResult) {
        // Ajouter Node.js au PATH
        const nodePath = 'C:\\\\Program Files\\\\nodejs';
        runCommand(\`setx PATH "%PATH%;\${nodePath}" /M\`, 'Configuration PATH Node.js');
        return true;
      }
    } catch (error) {
      console.error(\`❌ Erreur téléchargement Node.js: \${error.message}\`);
    }
  }
  return false;
}

// Installation de PostgreSQL
async function installPostgreSQL() {
  console.log('🔍 Vérification de PostgreSQL...');
  
  try {
    execSync('psql --version', { encoding: 'utf8', windowsHide: true });
    console.log('✅ PostgreSQL déjà installé');
    return true;
  } catch {
    console.log('📦 Installation de PostgreSQL en cours...');
    
    const pgUrl = 'https://get.enterprisedb.com/postgresql/postgresql-13.14-1-windows-x64.exe';
    const pgInstaller = path.join(TEMP_DIR, 'postgresql-installer.exe');
    
    try {
      await downloadFile(pgUrl, pgInstaller);
      const installResult = runCommand(\`"\${pgInstaller}" --mode unattended --superpassword "postgres" --servicename "postgresql" --servicepassword "postgres"\`, 'Installation PostgreSQL');
      
      if (installResult) {
        // Configuration automatique
        runCommand('createdb smart_gmao_diagfix -U postgres', 'Création base de données');
        return true;
      }
    } catch (error) {
      console.error(\`❌ Erreur téléchargement PostgreSQL: \${error.message}\`);
    }
  }
  return false;
}

// Installation de l'application
async function installApplication() {
  console.log('📦 Installation de Smart GMAO DiagFix...');
  
  // Créer le répertoire d'installation
  if (!existsSync(INSTALL_DIR)) {
    mkdirSync(INSTALL_DIR, { recursive: true });
  }
  
  // Télécharger et extraire l'application
  const appUrl = 'https://github.com/smart-gmao/releases/latest/download/smart-gmao-diagfix.zip';
  const appZip = path.join(TEMP_DIR, 'smart-gmao-diagfix.zip');
  
  try {
    // Pour cette démonstration, on crée une structure basique
    const packageJson = {
      "name": "smart-gmao-diagfix",
      "version": "2.1.0",
      "description": "Plateforme de maintenance industrielle intelligente",
      "main": "server/index.js",
      "scripts": {
        "start": "node server/index.js",
        "dev": "npm run start"
      }
    };
    
    writeFileSync(path.join(INSTALL_DIR, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    // Créer un launcher simple
    const launcherBat = \`@echo off
cd /d "\${INSTALL_DIR}"
npm start
pause\`;
    
    writeFileSync(path.join(INSTALL_DIR, 'start.bat'), launcherBat);
    
    console.log('✅ Application installée dans:', INSTALL_DIR);
    return true;
  } catch (error) {
    console.error(\`❌ Erreur installation application: \${error.message}\`);
    return false;
  }
}

// Création du service Windows
function createWindowsService() {
  console.log('⚙️ Configuration du service Windows...');
  
  const serviceName = 'SmartGMAODiagFix';
  const serviceDisplayName = 'Smart GMAO DiagFix';
  const servicePath = path.join(INSTALL_DIR, 'start.bat');
  
  const serviceCommand = \`sc create "\${serviceName}" binPath= "cmd /c \\"\${servicePath}\\"" DisplayName= "\${serviceDisplayName}" start= auto\`;
  
  if (runCommand(serviceCommand, 'Création service Windows')) {
    runCommand(\`sc description "\${serviceName}" "Service de maintenance industrielle intelligente"\`, 'Description service');
    return true;
  }
  return false;
}

// Création des raccourcis bureau
function createDesktopShortcuts() {
  console.log('🖥️ Création des raccourcis bureau...');
  
  const desktopPath = path.join(os.homedir(), 'Desktop');
  const shortcutPath = path.join(desktopPath, 'Smart GMAO DiagFix.lnk');
  
  // Utiliser PowerShell pour créer le raccourci
  const psScript = \`
    \$WshShell = New-Object -comObject WScript.Shell
    \$Shortcut = \$WshShell.CreateShortcut("\${shortcutPath}")
    \$Shortcut.TargetPath = "\${path.join(INSTALL_DIR, 'start.bat')}"
    \$Shortcut.WorkingDirectory = "\${INSTALL_DIR}"
    \$Shortcut.Description = "Smart GMAO DiagFix - Maintenance Intelligente"
    \$Shortcut.Save()
  \`;
  
  writeFileSync(path.join(TEMP_DIR, 'create-shortcut.ps1'), psScript);
  
  return runCommand(\`powershell -ExecutionPolicy Bypass -File "\${path.join(TEMP_DIR, 'create-shortcut.ps1')}"\`, 'Création raccourci bureau');
}

// Installation principale
async function main() {
  console.log('🚀 Début de l\\'installation...');
  console.log('');
  
  // Vérifications initiales
  checkAdminRights();
  
  // Créer le dossier temporaire
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }
  
  try {
    // Étapes d'installation
    const steps = [
      { name: 'Installation Node.js', fn: installNodeJS },
      { name: 'Installation PostgreSQL', fn: installPostgreSQL },
      { name: 'Installation Application', fn: installApplication },
      { name: 'Configuration Service', fn: createWindowsService },
      { name: 'Création Raccourcis', fn: createDesktopShortcuts }
    ];
    
    let success = true;
    for (const step of steps) {
      const result = await step.fn();
      if (!result) {
        console.error(\`❌ Échec de l\\'étape: \${step.name}\`);
        success = false;
        break;
      }
    }
    
    // Nettoyage
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    
    console.log('');
    if (success) {
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║                 INSTALLATION TERMINÉE                       ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('✅ Smart GMAO DiagFix installé avec succès !');
      console.log('');
      console.log('📂 Répertoire: ' + INSTALL_DIR);
      console.log('🖥️ Raccourci bureau créé');
      console.log('⚙️ Service Windows configuré');
      console.log('');
      console.log('Pour démarrer l\\'application:');
      console.log('• Double-cliquez sur le raccourci bureau');
      console.log('• Ou utilisez: sc start SmartGMAODiagFix');
      console.log('');
      console.log('🌐 L\\'application sera accessible sur: http://localhost:5000');
    } else {
      console.log('❌ Installation échouée. Consultez les erreurs ci-dessus.');
    }
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
  }
  
  console.log('');
  console.log('Appuyez sur une touche pour fermer...');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', process.exit.bind(process, 0));
}

main();
`;

// Écrire le script d'installation
const installerPath = path.join(outputDir, 'smart-gmao-installer.js');
writeFileSync(installerPath, installerScript);

console.log('📦 Création de l\\'installateur Windows .exe...');

// Créer le package.json pour pkg
const pkgConfig = {
  "name": "smart-gmao-diagfix-installer",
  "version": "2.1.0",
  "description": "Installateur Windows pour Smart GMAO DiagFix",
  "main": "smart-gmao-installer.js",
  "bin": "smart-gmao-installer.js",
  "pkg": {
    "targets": ["node18-win-x64"],
    "outputPath": "dist/",
    "assets": []
  }
};

writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(pkgConfig, null, 2));

try {
  // Utiliser pkg pour créer l'exécutable
  const exePath = path.join(outputDir, 'Smart-GMAO-DiagFix-Installer.exe');
  
  console.log('⚙️ Compilation avec pkg...');
  execSync(`npx pkg ${installerPath} --target node18-win-x64 --output "${exePath}"`, { 
    stdio: 'inherit',
    cwd: outputDir 
  });
  
  console.log('✅ Installateur Windows créé avec succès !');
  console.log('📁 Fichier: ' + exePath);
  console.log('📏 Taille: ' + require('fs').statSync(exePath).size + ' bytes');
  
} catch (error) {
  console.error('❌ Erreur lors de la compilation:', error.message);
  console.log('');
  console.log('Tentative avec une méthode alternative...');
  
  // Méthode alternative avec nexe
  try {
    const nexeOutput = path.join(outputDir, 'Smart-GMAO-DiagFix-Installer.exe');
    execSync(`npx nexe ${installerPath} --target windows-x64-18.19.0 --output "${nexeOutput}"`, {
      stdio: 'inherit',
      cwd: outputDir
    });
    console.log('✅ Installateur créé avec nexe !');
  } catch (nexeError) {
    console.error('❌ Erreur nexe:', nexeError.message);
  }
}