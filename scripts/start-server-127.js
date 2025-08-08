#!/usr/bin/env node

// Script pour démarrer le serveur sur 127.0.0.1:5000
import { spawn } from 'child_process';
import { existsSync } from 'fs';

console.log('🚀 Démarrage Smart GMAO DiagFix sur 127.0.0.1:5000');
console.log('='.repeat(50));

// Vérifier que nous sommes dans le bon répertoire
if (!existsSync('package.json')) {
  console.error('❌ Erreur: package.json introuvable');
  console.log('💡 Assurez-vous d\'être dans le répertoire du projet');
  process.exit(1);
}

// Démarrer le serveur
const server = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

// Gestion des signaux
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  server.kill('SIGTERM');
  process.exit(0);
});

server.on('error', (err) => {
  console.error('❌ Erreur de démarrage:', err.message);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Le serveur s'est arrêté avec le code ${code}`);
  }
  process.exit(code);
});

// Afficher les instructions
setTimeout(() => {
  console.log('\n📋 INSTRUCTIONS:');
  console.log('================');
  console.log('✅ Serveur en cours de démarrage...');
  console.log('🌐 Accédez à: http://127.0.0.1:5000');
  console.log('🔄 Attendez 10-15 secondes pour le chargement complet');
  console.log('⏹️  Appuyez sur Ctrl+C pour arrêter');
}, 2000);