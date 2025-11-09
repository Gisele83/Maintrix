#!/usr/bin/env node

/**
 * Installateur Windows Simple et Fonctionnel
 * Maintrix v2.1.0
 */

const { writeFileSync, mkdirSync, existsSync } = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║                Maintrix v2.1.0                      ║');
console.log('║                Installateur Windows                           ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log('🎯 Installation de Maintrix sur votre système');
console.log(`✅ Node.js détecté: ${process.version}\n`);

function main() {
  console.log('🔧 Création du répertoire d\'installation...');
  
  const installDir = path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'Smart-GMAO-Maintrix');
  
  try {
    if (!existsSync(installDir)) {
      mkdirSync(installDir, { recursive: true });
      console.log(`📁 Dossier créé: ${installDir}`);
    }
    
    // Package.json
    const packageJson = {
      "name": "maintrix",
      "version": "2.1.0",
      "description": "Plateforme de maintenance industrielle intelligente",
      "main": "server.js",
      "scripts": {
        "start": "node server.js"
      },
      "dependencies": {
        "express": "^4.18.2"
      }
    };
    
    writeFileSync(
      path.join(installDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Serveur simple
    const serverCode = `const express = require('express');
const app = express();
const PORT = 5000;

app.use(express.json());

// Page d'accueil
app.get('/', (req, res) => {
  res.send(\`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Maintrix</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                min-height: 100vh;
            }
            .container { 
                max-width: 800px; 
                margin: 0 auto; 
                text-align: center; 
            }
            .header { 
                background: rgba(255,255,255,0.1); 
                padding: 30px; 
                border-radius: 15px; 
                margin-bottom: 30px; 
                backdrop-filter: blur(10px);
            }
            .features { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
                gap: 20px; 
                margin-bottom: 30px;
            }
            .feature { 
                background: rgba(255,255,255,0.1); 
                padding: 20px; 
                border-radius: 10px; 
                backdrop-filter: blur(10px);
            }
            .btn { 
                background: #4CAF50; 
                color: white; 
                padding: 12px 24px; 
                border: none; 
                border-radius: 5px; 
                cursor: pointer; 
                font-size: 16px; 
                margin: 10px; 
                text-decoration: none;
                display: inline-block;
            }
            .btn:hover { 
                background: #45a049; 
            }
            .status {
                background: rgba(76, 175, 80, 0.2);
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0;
                border: 1px solid #4CAF50;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Maintrix</h1>
                <h2>Installation Réussie !</h2>
                <p>Plateforme de maintenance industrielle intelligente v2.1.0</p>
            </div>
            
            <div class="status">
                <h3>✅ Système Opérationnel</h3>
                <p>🌐 Serveur local actif sur le port \${PORT}</p>
                <p>📅 Démarré le: \${new Date().toLocaleDateString('fr-FR')}</p>
            </div>
            
            <div class="features">
                <div class="feature">
                    <h3>🔧 Module GMAO</h3>
                    <p>Gestion complète des équipements et maintenance préventive</p>
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
            
            <div>
                <a href="/api/status" class="btn">📊 Statut API</a>
                <a href="https://github.com/maintrix/docs" target="_blank" class="btn">📚 Documentation</a>
            </div>
            
            <div style="margin-top: 30px; font-size: 14px; opacity: 0.8;">
                <p>💡 Pour accéder à l'interface complète, visitez le déploiement cloud</p>
                <p>🔧 Installation locale configurée avec succès</p>
            </div>
        </div>
    </body>
    </html>
  \`);
});

// API basique
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    message: 'Maintrix - Installation locale active'
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 Maintrix démarré sur http://localhost:\${PORT}\`);
  console.log('📝 Installation locale configurée avec succès');
});
`;
    
    writeFileSync(path.join(installDir, 'server.js'), serverCode);
    
    // Script de démarrage Windows
    const startScript = `@echo off
echo 🚀 Démarrage de Maintrix...
cd "%USERPROFILE%\\Smart-GMAO-Maintrix"
echo 📦 Installation des dépendances...
npm install --silent
echo ✅ Démarrage du serveur...
npm start
pause
`;
    
    writeFileSync(path.join(installDir, 'start.bat'), startScript);
    
    // Raccourci bureau
    const desktopPath = path.join(process.env.USERPROFILE, 'Desktop');
    if (existsSync(desktopPath)) {
      const shortcut = `@echo off
cd "%USERPROFILE%\\Smart-GMAO-Maintrix"
start "" "http://localhost:5000"
npm start
`;
      writeFileSync(path.join(desktopPath, 'Smart-GMAO-Maintrix.bat'), shortcut);
      console.log('🖥️ Raccourci bureau créé');
    }
    
    console.log('✅ Installation terminée avec succès !');
    console.log(`📁 Répertoire: ${installDir}`);
    console.log('🚀 Pour démarrer: double-cliquez sur start.bat');
    console.log('🌐 URL locale: http://localhost:5000');
    
    console.log('\n🎉 Maintrix est maintenant installé !');
    console.log('✋ Appuyez sur ENTRÉE pour terminer...');
    
    rl.question('', () => {
      rl.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'installation:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Démarrer l'installation
main();