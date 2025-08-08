#!/usr/bin/env node

/**
 * Installateur Windows Simple (.exe)
 * Smart GMAO DiagFix v2.1.0
 */

const { execSync } = require('child_process');
const { writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');
const os = require('os');

console.log('Smart GMAO DiagFix - Installateur Windows v2.1.0');
console.log('=====================================================');

const INSTALL_DIR = path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Smart GMAO DiagFix');

function runCommand(command, description) {
  console.log(`Exécution: ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`Succès: ${description}`);
    return true;
  } catch (error) {
    console.error(`Erreur: ${description} - ${error.message}`);
    return false;
  }
}

function checkAdmin() {
  try {
    execSync('net session >nul 2>&1');
    return true;
  } catch {
    console.error('ERREUR: Droits administrateur requis');
    console.log('Relancez en tant qu\'administrateur');
    process.exit(1);
  }
}

function installNodeJS() {
  try {
    execSync('node --version');
    console.log('Node.js déjà installé');
    return true;
  } catch {
    console.log('Installation de Node.js...');
    console.log('Téléchargez Node.js depuis: https://nodejs.org/');
    return false;
  }
}

function createApplication() {
  console.log('Installation de Smart GMAO DiagFix...');
  
  if (!existsSync(INSTALL_DIR)) {
    mkdirSync(INSTALL_DIR, { recursive: true });
  }
  
  const packageJson = {
    "name": "smart-gmao-diagfix",
    "version": "2.1.0",
    "description": "Maintenance industrielle intelligente",
    "main": "index.js",
    "scripts": {
      "start": "node index.js"
    }
  };
  
  const startScript = `
const express = require('express');
const app = express();
const port = 5000;

app.get('/', (req, res) => {
  res.send('<h1>Smart GMAO DiagFix</h1><p>Installation réussie!</p>');
});

app.listen(port, () => {
  console.log('Smart GMAO DiagFix démarré sur http://localhost:5000');
});
`;
  
  writeFileSync(path.join(INSTALL_DIR, 'package.json'), JSON.stringify(packageJson, null, 2));
  writeFileSync(path.join(INSTALL_DIR, 'index.js'), startScript);
  
  const launcher = `@echo off
cd /d "${INSTALL_DIR}"
echo Démarrage de Smart GMAO DiagFix...
node index.js
pause`;
  
  writeFileSync(path.join(INSTALL_DIR, 'start.bat'), launcher);
  
  return true;
}

function createDesktopShortcut() {
  const desktop = path.join(os.homedir(), 'Desktop');
  const shortcut = path.join(desktop, 'Smart GMAO DiagFix.bat');
  
  const shortcutContent = `@echo off
cd /d "${INSTALL_DIR}"
start "" node index.js`;
  
  writeFileSync(shortcut, shortcutContent);
  console.log('Raccourci bureau créé');
  return true;
}

function main() {
  console.log('Début installation...');
  
  checkAdmin();
  
  if (!installNodeJS()) {
    console.log('Installez Node.js puis relancez cet installateur');
    return;
  }
  
  if (createApplication() && createDesktopShortcut()) {
    console.log('');
    console.log('INSTALLATION TERMINÉE !');
    console.log('========================');
    console.log('Répertoire: ' + INSTALL_DIR);
    console.log('Raccourci: Bureau');
    console.log('URL: http://localhost:5000');
    console.log('');
    console.log('Double-cliquez sur le raccourci pour démarrer');
  } else {
    console.log('Installation échouée');
  }
}

main();