#!/usr/bin/env node

/**
 * Générateur d'installateur Windows pour Smart GMAO DiagFix
 * Crée un package .exe autonome avec installation automatique
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration de l'installateur
const INSTALLER_CONFIG = {
  name: 'Smart GMAO DiagFix',
  version: '2.1.0',
  description: 'Plateforme de maintenance industrielle intelligente',
  author: 'Smart GMAO DiagFix Team',
  executable: 'smart-gmao-diagfix-installer.exe',
  icon: 'assets/icon.ico',
  license: 'MIT'
};

// Script d'installation Windows (PowerShell)
const WINDOWS_INSTALL_SCRIPT = `
# Smart GMAO DiagFix - Installateur Windows
# Version 2.1.0

Write-Host "=== Smart GMAO DiagFix - Installateur Windows ===" -ForegroundColor Green
Write-Host "Installation en cours..." -ForegroundColor Yellow

# Vérification des prérequis
Write-Host "Vérification des prérequis..." -ForegroundColor Cyan

# Vérifier Node.js
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js détecté: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js non trouvé. Installation automatique..." -ForegroundColor Red
    
    # Télécharger et installer Node.js
    $nodeUrl = "https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi"
    $nodeInstaller = "$env:TEMP\\node-installer.msi"
    
    Write-Host "Téléchargement de Node.js..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller
    
    Write-Host "Installation de Node.js..." -ForegroundColor Yellow
    Start-Process msiexec.exe -Wait -ArgumentList '/I', $nodeInstaller, '/quiet'
    
    # Actualiser la variable PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
    
    Write-Host "✓ Node.js installé avec succès" -ForegroundColor Green
}

# Vérifier PostgreSQL
try {
    $pgVersion = psql --version
    Write-Host "✓ PostgreSQL détecté: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ PostgreSQL non trouvé. Installation automatique..." -ForegroundColor Red
    
    # Télécharger et installer PostgreSQL
    $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-15.5-1-windows-x64.exe"
    $pgInstaller = "$env:TEMP\\postgresql-installer.exe"
    
    Write-Host "Téléchargement de PostgreSQL..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $pgUrl -OutFile $pgInstaller
    
    Write-Host "Installation de PostgreSQL..." -ForegroundColor Yellow
    Start-Process $pgInstaller -Wait -ArgumentList '--mode', 'unattended', '--superpassword', 'postgres123'
    
    Write-Host "✓ PostgreSQL installé avec succès" -ForegroundColor Green
}

# Créer le répertoire d'installation
$installDir = "$env:ProgramFiles\\Smart GMAO DiagFix"
Write-Host "Création du répertoire d'installation: $installDir" -ForegroundColor Cyan

if (Test-Path $installDir) {
    Remove-Item $installDir -Recurse -Force
}
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

# Extraire les fichiers de l'application
Write-Host "Extraction des fichiers..." -ForegroundColor Cyan
$currentDir = Get-Location
Copy-Item "$currentDir\\*" $installDir -Recurse -Force

# Installation des dépendances
Write-Host "Installation des dépendances npm..." -ForegroundColor Cyan
Set-Location $installDir
npm install --production

# Configuration de la base de données
Write-Host "Configuration de la base de données..." -ForegroundColor Cyan
$dbName = "smart_gmao_diagfix"
$dbUser = "gmao_user"
$dbPassword = "gmao_password_2025"

# Créer la base de données
$createDbScript = @"
CREATE DATABASE $dbName;
CREATE USER $dbUser WITH ENCRYPTED PASSWORD '$dbPassword';
GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;
"@

$createDbScript | psql -U postgres -h localhost

# Configuration du fichier .env
$envContent = @"
DATABASE_URL=postgresql://$dbUser:$dbPassword@localhost:5432/$dbName
NODE_ENV=production
PORT=3000
SESSION_SECRET=smart_gmao_secret_key_2025
"@

$envContent | Out-File -FilePath "$installDir\\.env" -Encoding UTF8

# Initialisation de la base de données
Write-Host "Initialisation de la base de données..." -ForegroundColor Cyan
npm run db:push

# Création du service Windows
Write-Host "Création du service Windows..." -ForegroundColor Cyan
$serviceName = "SmartGMAODiagFix"
$serviceDisplayName = "Smart GMAO DiagFix Service"
$serviceDescription = "Service de maintenance industrielle intelligente"
$serviceExePath = "node $installDir\\server\\index.js"

# Créer le script de service
$serviceScript = @"
const { Service } = require('node-windows');

const svc = new Service({
  name: '$serviceName',
  description: '$serviceDescription',
  script: '$installDir\\\\server\\\\index.js',
  env: {
    name: 'NODE_ENV',
    value: 'production'
  }
});

svc.on('install', function() {
  svc.start();
});

svc.install();
"@

$serviceScript | Out-File -FilePath "$installDir\\install-service.js" -Encoding UTF8

# Installer le service
npm install -g node-windows
node "$installDir\\install-service.js"

# Créer les raccourcis
Write-Host "Création des raccourcis..." -ForegroundColor Cyan

# Raccourci Bureau
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\\Desktop\\Smart GMAO DiagFix.lnk")
$Shortcut.TargetPath = "http://localhost:3000"
$Shortcut.Save()

# Raccourci Menu Démarrer
$startMenuPath = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Smart GMAO DiagFix.lnk"
$Shortcut = $WshShell.CreateShortcut($startMenuPath)
$Shortcut.TargetPath = "http://localhost:3000"
$Shortcut.Save()

# Configuration du pare-feu
Write-Host "Configuration du pare-feu..." -ForegroundColor Cyan
netsh advfirewall firewall add rule name="Smart GMAO DiagFix" dir=in action=allow protocol=TCP localport=3000

# Installation terminée
Write-Host "" -ForegroundColor White
Write-Host "=== INSTALLATION TERMINÉE ===" -ForegroundColor Green
Write-Host "" -ForegroundColor White
Write-Host "Smart GMAO DiagFix a été installé avec succès !" -ForegroundColor Green
Write-Host "" -ForegroundColor White
Write-Host "Accès à l'application:" -ForegroundColor Cyan
Write-Host "• URL: http://localhost:3000" -ForegroundColor White
Write-Host "• Raccourci sur le Bureau créé" -ForegroundColor White
Write-Host "• Service Windows configuré et démarré" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "Base de données:" -ForegroundColor Cyan
Write-Host "• PostgreSQL configuré automatiquement" -ForegroundColor White
Write-Host "• Base: $dbName" -ForegroundColor White
Write-Host "• Utilisateur: $dbUser" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "L'application va s'ouvrir automatiquement..." -ForegroundColor Yellow

# Ouvrir l'application
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host "Installation complète ! Profitez de Smart GMAO DiagFix." -ForegroundColor Green
Read-Host "Appuyez sur Entrée pour fermer cet installateur"
`;

// Package.json pour l'installateur
const INSTALLER_PACKAGE = {
  "name": "smart-gmao-diagfix-installer",
  "version": INSTALLER_CONFIG.version,
  "description": INSTALLER_CONFIG.description,
  "main": "install.js",
  "scripts": {
    "build": "pkg install.js --target node18-win-x64 --output smart-gmao-diagfix-installer.exe"
  },
  "dependencies": {
    "node-windows": "^1.0.0-beta.8"
  },
  "devDependencies": {
    "pkg": "^5.8.1"
  },
  "pkg": {
    "assets": [
      "install.ps1",
      "../**/*"
    ],
    "targets": [
      "node18-win-x64"
    ]
  }
};

// Script principal de l'installateur
const INSTALLER_MAIN_SCRIPT = `
const { execSync } = require('child_process');
const { writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');

console.log('Smart GMAO DiagFix - Installateur Windows');
console.log('========================================');

try {
  // Créer le répertoire temporaire
  const tempDir = path.join(process.env.TEMP, 'smart-gmao-diagfix-installer');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  // Extraire le script PowerShell
  const installScriptPath = path.join(tempDir, 'install.ps1');
  writeFileSync(installScriptPath, \`${WINDOWS_INSTALL_SCRIPT.replace(/`/g, '\\`')}\`);

  // Exécuter l'installation
  console.log('Démarrage de l\\'installation...');
  execSync(\`powershell -ExecutionPolicy Bypass -File "\${installScriptPath}"\`, {
    stdio: 'inherit'
  });

} catch (error) {
  console.error('Erreur lors de l\\'installation:', error.message);
  console.log('Appuyez sur Entrée pour fermer...');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', process.exit.bind(process, 0));
}
`;

function createWindowsInstaller() {
  console.log('🚀 Création de l\'installateur Windows...');

  // Créer le répertoire de build
  const buildDir = join(__dirname, 'windows-installer');
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, { recursive: true });
  }

  // Créer le package.json
  const packagePath = join(buildDir, 'package.json');
  writeFileSync(packagePath, JSON.stringify(INSTALLER_PACKAGE, null, 2));

  // Créer le script principal
  const mainScriptPath = join(buildDir, 'install.js');
  writeFileSync(mainScriptPath, INSTALLER_MAIN_SCRIPT);

  // Créer le script PowerShell
  const psScriptPath = join(buildDir, 'install.ps1');
  writeFileSync(psScriptPath, WINDOWS_INSTALL_SCRIPT);

  console.log('✅ Fichiers de l\'installateur créés');

  // Installer les dépendances et construire l'exe
  try {
    console.log('📦 Installation des dépendances...');
    execSync('npm install', { cwd: buildDir, stdio: 'inherit' });

    console.log('🔨 Construction de l\'exécutable...');
    execSync('npm run build', { cwd: buildDir, stdio: 'inherit' });

    console.log('✅ Installateur Windows créé avec succès !');
    console.log(`📁 Fichier: ${join(buildDir, INSTALLER_CONFIG.executable)}`);

  } catch (error) {
    console.error('❌ Erreur lors de la construction:', error.message);
    process.exit(1);
  }
}

// Fonction pour créer un installateur NSIS (alternative)
function createNSISInstaller() {
  const nsisScript = `
; Smart GMAO DiagFix - Script d'installation NSIS
; Version ${INSTALLER_CONFIG.version}

!define APPNAME "${INSTALLER_CONFIG.name}"
!define APPVERSION "${INSTALLER_CONFIG.version}"
!define DESCRIPTION "${INSTALLER_CONFIG.description}"
!define VERSIONMAJOR "2"
!define VERSIONMINOR "1"
!define VERSIONBUILD "0"

RequestExecutionLevel admin
InstallDir "$PROGRAMFILES\\Smart GMAO DiagFix"
Name "\${APPNAME}"
OutFile "smart-gmao-diagfix-setup.exe"

Page directory
Page instfiles

Section "Smart GMAO DiagFix"
  SetOutPath $INSTDIR
  
  ; Copier tous les fichiers
  File /r "*.*"
  
  ; Créer les raccourcis
  CreateDirectory "$SMPROGRAMS\\Smart GMAO DiagFix"
  CreateShortcut "$SMPROGRAMS\\Smart GMAO DiagFix\\Smart GMAO DiagFix.lnk" "http://localhost:3000"
  CreateShortcut "$DESKTOP\\Smart GMAO DiagFix.lnk" "http://localhost:3000"
  
  ; Installer Node.js si nécessaire
  ExecWait '"$INSTDIR\\install-nodejs.exe" /S'
  
  ; Installer PostgreSQL si nécessaire
  ExecWait '"$INSTDIR\\install-postgresql.exe" /S'
  
  ; Configurer l'application
  ExecWait 'powershell -ExecutionPolicy Bypass -File "$INSTDIR\\configure.ps1"'
  
  ; Démarrer le service
  ExecWait '"$INSTDIR\\start-service.bat"'
  
  ; Ouvrir l'application
  ExecShell "open" "http://localhost:3000"
SectionEnd

UninstallText "Désinstaller Smart GMAO DiagFix"
Section "Uninstall"
  ; Arrêter le service
  ExecWait 'sc stop SmartGMAODiagFix'
  ExecWait 'sc delete SmartGMAODiagFix'
  
  ; Supprimer les fichiers
  RMDir /r $INSTDIR
  
  ; Supprimer les raccourcis
  Delete "$SMPROGRAMS\\Smart GMAO DiagFix\\Smart GMAO DiagFix.lnk"
  Delete "$DESKTOP\\Smart GMAO DiagFix.lnk"
  RMDir "$SMPROGRAMS\\Smart GMAO DiagFix"
SectionEnd
`;

  const buildDir = join(__dirname, 'nsis-installer');
  if (!existsSync(buildDir)) {
    mkdirSync(buildDir, { recursive: true });
  }

  const nsisPath = join(buildDir, 'installer.nsi');
  writeFileSync(nsisPath, nsisScript);

  console.log('📄 Script NSIS créé:', nsisPath);
  console.log('Pour compiler: makensis installer.nsi');
}

// Exporter les fonctions
export { createWindowsInstaller, createNSISInstaller };

// Exécuter si appelé directement
if (process.argv[1] === __filename) {
  const command = process.argv[2] || 'windows';
  
  switch (command) {
    case 'windows':
      createWindowsInstaller();
      break;
    case 'nsis':
      createNSISInstaller();
      break;
    default:
      console.log('Usage: node create-windows-installer.js [windows|nsis]');
  }
}