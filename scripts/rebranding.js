#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Pattern de remplacement (ordre important pour éviter les remplacements en cascade)
const REPLACEMENTS = [
  // Texte complet
  { from: /Smart GMAO DiagFix/g, to: 'Maintrix' },
  { from: /Smart DiagFix/g, to: 'Maintrix' },
  { from: /SMDiagFix/g, to: 'Maintrix' },
  { from: /DiagFix/g, to: 'Maintrix' },
  
  // Kebab-case
  { from: /smart-gmao-diagfix/g, to: 'maintrix' },
  { from: /smart-diagfix/g, to: 'maintrix' },
  
  // Snake_case (database/variables)
  { from: /smart_gmao_diagfix/g, to: 'maintrix_db' },
  { from: /smart_gmao_user/g, to: 'maintrix_user' },
  { from: /smart_gmao/g, to: 'maintrix' },
  
  // CamelCase
  { from: /SmartGMAODiagFix/g, to: 'Maintrix' },
  { from: /SmartDiagFix/g, to: 'Maintrix' },
  
  // Chemins système
  { from: /\/opt\/smart-gmao-diagfix/g, to: '/opt/maintrix' },
  
  // Domaines (à garder pour référence historique dans certains contextes)
  // { from: /smart-gmao-diagfix\.com/g, to: 'maintrix-t.com' },
];

// Fichiers à exclure (binaires, node_modules, etc.)
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /\.local\//,  // Fichiers Replit internes
  /dist\//,
  /\.next\//,
  /\.apk$/,
  /\.exe$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.ico$/,
  /\.svg$/,
  /\.pdf$/,
  /\.zip$/,
  /\.tar\.gz$/,
  /\.lock$/,
  /package-lock\.json$/,
  /\.log$/,
  /rebranding\.js$/,  // Ne pas se rebrand soi-même
];

// Extensions de fichiers à traiter
const INCLUDE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.sh', '.bat',
  '.yml', '.yaml', '.env', '.txt', '.service', '.conf', '.html',
  '.css', '.sql'
];

let stats = {
  filesScanned: 0,
  filesModified: 0,
  replacements: 0,
  errors: 0
};

function shouldProcessFile(filePath) {
  // Vérifier exclusions
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(filePath)) {
      return false;
    }
  }
  
  // Vérifier extensions
  const ext = path.extname(filePath);
  return INCLUDE_EXTENSIONS.includes(ext) || !ext;
}

function processFile(filePath, dryRun = false) {
  try {
    stats.filesScanned++;
    
    const content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    let fileReplacements = 0;
    
    // Appliquer tous les remplacements
    for (const { from, to } of REPLACEMENTS) {
      const matches = content.match(from);
      if (matches) {
        newContent = newContent.replace(from, to);
        fileReplacements += matches.length;
      }
    }
    
    // Si des changements ont été faits
    if (newContent !== content) {
      stats.filesModified++;
      stats.replacements += fileReplacements;
      
      console.log(`${dryRun ? '[DRY-RUN] ' : ''}✏️  ${filePath} (${fileReplacements} remplacements)`);
      
      if (!dryRun) {
        fs.writeFileSync(filePath, newContent, 'utf8');
      }
    }
  } catch (error) {
    stats.errors++;
    console.error(`❌ Erreur traitement ${filePath}:`, error.message);
  }
}

function scanDirectory(dir, dryRun = false) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!EXCLUDE_PATTERNS.some(pattern => pattern.test(fullPath))) {
        scanDirectory(fullPath, dryRun);
      }
    } else if (entry.isFile()) {
      if (shouldProcessFile(fullPath)) {
        processFile(fullPath, dryRun);
      }
    }
  }
}

// Main
const dryRun = process.argv.includes('--dry-run');
const args = process.argv.slice(2).filter(arg => arg !== '--dry-run');
const targetDir = args[0] || rootDir;

console.log('🔄 REBRANDING: Smart GMAO DiagFix → Maintrix');
console.log('============================================');
console.log(`Mode: ${dryRun ? 'DRY-RUN (simulation)' : 'PRODUCTION (modifications réelles)'}`);
console.log(`Répertoire: ${targetDir}`);
console.log('');

if (dryRun) {
  console.log('⚠️  Mode DRY-RUN activé - aucune modification ne sera effectuée\n');
}

const startTime = Date.now();
scanDirectory(targetDir, dryRun);
const duration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n📊 STATISTIQUES');
console.log('============================================');
console.log(`Fichiers scannés: ${stats.filesScanned}`);
console.log(`Fichiers modifiés: ${stats.filesModified}`);
console.log(`Remplacements effectués: ${stats.replacements}`);
console.log(`Erreurs: ${stats.errors}`);
console.log(`Durée: ${duration}s`);

if (dryRun) {
  console.log('\n✅ Dry-run terminé - relancez sans --dry-run pour appliquer les changements');
} else {
  console.log('\n✅ Rebranding terminé avec succès!');
}

process.exit(stats.errors > 0 ? 1 : 0);
