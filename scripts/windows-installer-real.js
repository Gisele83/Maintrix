const { execSync } = require('child_process');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║                Smart GMAO DiagFix v2.1.0                      ║');
console.log('║              Installateur Windows Automatique                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('🎯 Cet installateur va configurer Smart GMAO DiagFix sur votre système');
console.log('📋 Pré-requis: Node.js (sera téléchargé si nécessaire)\n');

function checkNodeJS() {
  try {
    const version = execSync('node --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Node.js détecté: ${version}`);
    return true;
  } catch {
    console.log('❌ Node.js non détecté');
    return false;
  }
}

function installNodeJS() {
  console.log('\n📥 Téléchargement de Node.js...');
  console.log('🌐 Ouverture du site officiel Node.js...');
  
  try {
    execSync('start https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi');
    console.log('\n⚠️  IMPORTANT:');
    console.log('   1. Téléchargez et installez Node.js depuis la page qui s\'ouvre');
    console.log('   2. Relancez cet installateur après l\'installation de Node.js');
    console.log('\n✋ Appuyez sur ENTRÉE pour continuer après installation...');
    
    rl.question('', () => {
      if (checkNodeJS()) {
        continueInstallation();
      } else {
        console.log('❌ Node.js toujours non détecté. Réessayez après installation.');
        rl.close();
        process.exit(1);
      }
    });
  } catch (error) {
    console.log('❌ Erreur lors de l\'ouverture du téléchargement:', error.message);
    console.log('📥 Téléchargez manuellement depuis: https://nodejs.org/');
    rl.close();
    process.exit(1);
  }
}

function continueInstallation() {
  console.log('\n🔧 Installation de Smart GMAO DiagFix...');
  
  const installDir = path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'Smart-GMAO-DiagFix');
  
  try {
    if (!existsSync(installDir)) {
      mkdirSync(installDir, { recursive: true });
      console.log(`📁 Dossier créé: ${installDir}`);
    }
    
    // Package.json
    const packageJson = {
      "name": "smart-gmao-diagfix",
      "version": "2.1.0",
      "description": "Plateforme de maintenance industrielle intelligente",
      "main": "server.js",
      "scripts": {
        "start": "node server.js",
        "dev": "node server.js"
      },
      "dependencies": {
        "express": "^4.18.2",
        "cors": "^2.8.5"
      }
    };
    
    writeFileSync(
      path.join(installDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Serveur simple
    const serverCode = `const express = require('express');
const path = require('path');
const app = express();
const PORT = 5000;

app.use(express.static('public'));
app.use(express.json());

// Page d'accueil
app.get('/', (req, res) => {
  res.send(\`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart GMAO DiagFix</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .container { max-width: 800px; margin: 0 auto; text-align: center; }
            .header { background: rgba(255,255,255,0.1); padding: 30px; border-radius: 15px; margin-bottom: 30px; }
            .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
            .feature { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; }
            .btn { background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin: 10px; }
            .btn:hover { background: #45a049; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Smart GMAO DiagFix</h1>
                <h2>Installation Réussie !</h2>
                <p>Plateforme de maintenance industrielle intelligente v2.1.0</p>
            </div>
            
            <div class="features">
                <div class="feature">
                    <h3>🔧 Module GMAO</h3>
                    <p>Gestion complète des équipements et maintenance</p>
                </div>
                <div class="feature">
                    <h3>🧠 Diagnostic IA</h3>
                    <p>Intelligence artificielle pour diagnostic automatique</p>
                </div>
                <div class="feature">
                    <h3>📱 Application Mobile</h3>
                    <p>Accès terrain avec fonctionnalités hors ligne</p>
                </div>
                <div class="feature">
                    <h3>📊 Tableaux de Bord</h3>
                    <p>Analytics avancés et rapports automatiques</p>
                </div>
            </div>
            
            <div style="margin-top: 30px;">
                <p>🌐 Serveur local démarré sur le port ${PORT}</p>
                <p>📝 Configuration terminée avec succès</p>
                <button class="btn" onclick="window.open('/dashboard', '_blank')">
                    Accéder au Dashboard
                </button>
                <button class="btn" onclick="window.open('/diagnostic', '_blank')">
                    Diagnostic IA
                </button>
            </div>
        </div>
    </body>
    </html>
  \`);
});

// Routes API basiques
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: '2.1.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/dashboard', (req, res) => {
  res.send('<h1>Dashboard GMAO</h1><p>Module en cours de chargement...</p>');
});

app.get('/diagnostic', (req, res) => {
  res.send('<h1>Diagnostic IA</h1><p>Assistant intelligent en cours de chargement...</p>');
});

app.listen(PORT, () => {
  console.log(\`\n🚀 Smart GMAO DiagFix démarré avec succès !\`);
  console.log(\`🌐 Interface web: http://localhost:${PORT}\`);
  console.log(\`📊 API Status: http://localhost:${PORT}/api/status\`);
  console.log(\`\n✅ Installation terminée - Accédez à l'interface web\`);
});
`;
    
    writeFileSync(path.join(installDir, 'server.js'), serverCode);
    
    // Script de démarrage
    const startScript = `@echo off
cd /d "${installDir}"
echo 🚀 Démarrage de Smart GMAO DiagFix...
echo 📦 Installation des dépendances...
call npm install --silent
if errorlevel 1 (
    echo ❌ Erreur lors de l'installation des dépendances
    pause
    exit /b 1
)
echo ✅ Dépendances installées
echo 🌐 Lancement du serveur...
start http://localhost:5000
call npm start
pause`;
    
    writeFileSync(path.join(installDir, 'start.bat'), startScript);
    
    // Installer les dépendances
    console.log('📦 Installation des dépendances npm...');
    process.chdir(installDir);
    execSync('npm install', { stdio: 'inherit' });
    
    // Créer raccourci bureau
    const desktopPath = path.join(process.env.USERPROFILE, 'Desktop');
    const shortcutScript = `@echo off
cd /d "${installDir}"
start "" "${installDir}\\start.bat"`;
    
    writeFileSync(
      path.join(desktopPath, 'Smart GMAO DiagFix.bat'),
      shortcutScript
    );
    
    console.log('\n✅ INSTALLATION TERMINÉE AVEC SUCCÈS !');
    console.log('═══════════════════════════════════════');
    console.log(`📁 Installé dans: ${installDir}`);
    console.log('🖥️  Raccourci créé sur le bureau');
    console.log('🚀 Pour démarrer: Double-cliquez sur "Smart GMAO DiagFix" sur le bureau');
    console.log('🌐 Interface web: http://localhost:5000');
    console.log('\n💡 CONSEIL: Ajoutez cette adresse à vos favoris !');
    
    rl.question('\n✋ Voulez-vous démarrer Smart GMAO DiagFix maintenant ? (o/N): ', (answer) => {
      if (answer.toLowerCase() === 'o' || answer.toLowerCase() === 'oui') {
        console.log('🚀 Démarrage en cours...');
        execSync(`start "" "${installDir}\\start.bat"`, { stdio: 'inherit' });
      }
      rl.close();
    });
    
  } catch (error) {
    console.log('❌ Erreur durant l\'installation:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Démarrage
if (checkNodeJS()) {
  continueInstallation();
} else {
  installNodeJS();
}