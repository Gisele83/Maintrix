#!/usr/bin/env node

// Serveur de secours sur port alternatif pour contourner les blocages
import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EMERGENCY_PORT = 8080;
const MAIN_PORT = 5000;

console.log('🚨 SERVEUR DE SECOURS - Smart GMAO DiagFix');
console.log('=' .repeat(50));

// Test du serveur principal
function testMainServer() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: MAIN_PORT,
      path: '/api/health',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve({ success: true, status: res.statusCode });
    });
    
    req.on('error', () => resolve({ success: false }));
    req.on('timeout', () => resolve({ success: false }));
    req.end();
  });
}

// Page HTML de diagnostic
function getDiagnosticPage(mainServerStatus) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart GMAO DiagFix - Diagnostic</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .container { max-width: 800px; margin: 0 auto; background: rgba(255,255,255,0.1); border-radius: 15px; padding: 30px; backdrop-filter: blur(10px); }
        h1 { text-align: center; margin-bottom: 30px; }
        .status { padding: 15px; border-radius: 8px; margin: 15px 0; }
        .success { background: rgba(0,255,0,0.2); border: 2px solid #00ff00; }
        .error { background: rgba(255,0,0,0.2); border: 2px solid #ff4444; }
        .warning { background: rgba(255,165,0,0.2); border: 2px solid #ffa500; }
        .btn { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px; border: none; cursor: pointer; }
        .btn:hover { background: #45a049; }
        .btn-red { background: #f44336; }
        .btn-red:hover { background: #d32f2f; }
        .instructions { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; }
        .code { background: rgba(0,0,0,0.3); padding: 10px; border-radius: 5px; font-family: monospace; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 Smart GMAO DiagFix - Diagnostic de Connectivité</h1>
        
        <div class="status ${mainServerStatus.success ? 'success' : 'error'}">
            <h3>État du Serveur Principal (Port 5000)</h3>
            ${mainServerStatus.success ? 
                '✅ Serveur principal ACTIF et fonctionnel' : 
                '❌ Serveur principal INACCESSIBLE depuis ce port'}
        </div>
        
        <div class="status success">
            <h3>Serveur de Secours (Port 8080)</h3>
            ✅ Vous accédez actuellement au serveur de secours<br>
            Port utilisé: 8080 (contournement des blocages)
        </div>
        
        <div class="instructions">
            <h3>🎯 Solutions pour Accéder à l'Application</h3>
            
            <h4>Option 1 - Liens Directs (Testez dans l'ordre):</h4>
            <a href="http://127.0.0.1:5000" target="_blank" class="btn">Essayer 127.0.0.1:5000</a>
            <a href="http://localhost:5000" target="_blank" class="btn">Essayer localhost:5000</a>
            <a href="http://0.0.0.0:5000" target="_blank" class="btn">Essayer 0.0.0.0:5000</a>
            
            <h4>Option 2 - Désactiver temporairement les blocages:</h4>
            <div class="status warning">
                <strong>Pare-feu Windows:</strong><br>
                1. Panneau de configuration → Système et sécurité → Pare-feu Windows<br>
                2. "Autoriser une application via le pare-feu"<br>
                3. Ajouter Node.js ou autoriser le port 5000
            </div>
            
            <div class="status warning">
                <strong>Antivirus:</strong><br>
                1. Ajoutez Smart GMAO DiagFix aux exceptions<br>
                2. Autorisez les connexions sur le port 5000<br>
                3. Désactivez temporairement la protection web
            </div>
            
            <h4>Option 3 - Modifier le fichier hosts (Windows):</h4>
            <div class="code">
C:\\Windows\\System32\\drivers\\etc\\hosts<br><br>
Ajoutez la ligne:<br>
127.0.0.1 localhost
            </div>
        </div>
        
        <div class="instructions">
            <h3>🚀 Tests de Connectivité</h3>
            <button class="btn" onclick="testConnectivity()">Retester la Connectivité</button>
            <button class="btn btn-red" onclick="window.close()">Fermer cette Page</button>
            
            <div id="testResults" style="margin-top: 20px;"></div>
        </div>
        
        <div class="status warning">
            <h3>ℹ️ Informations Techniques</h3>
            <strong>Application:</strong> Smart GMAO DiagFix<br>
            <strong>Port Principal:</strong> 5000<br>
            <strong>Port Secours:</strong> 8080 (cette page)<br>
            <strong>Protocole:</strong> HTTP<br>
            <strong>Adresses testées:</strong> localhost, 127.0.0.1, 0.0.0.0
        </div>
    </div>
    
    <script>
        function testConnectivity() {
            const results = document.getElementById('testResults');
            results.innerHTML = '<p>🔍 Test en cours...</p>';
            
            const urls = [
                'http://127.0.0.1:5000/api/health',
                'http://localhost:5000/api/health',
                'http://0.0.0.0:5000/api/health'
            ];
            
            let html = '<h4>Résultats des Tests:</h4>';
            let completed = 0;
            
            urls.forEach((url, index) => {
                fetch(url)
                .then(response => {
                    html += '<div class="status success">✅ ' + url + ' - Accessible</div>';
                })
                .catch(error => {
                    html += '<div class="status error">❌ ' + url + ' - Bloqué</div>';
                })
                .finally(() => {
                    completed++;
                    if (completed === urls.length) {
                        results.innerHTML = html;
                    }
                });
            });
        }
        
        // Test automatique au chargement
        setTimeout(testConnectivity, 1000);
    </script>
</body>
</html>`;
}

// Créer le serveur de secours
async function startEmergencyServer() {
  const mainStatus = await testMainServer();
  
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    
    if (req.url === '/') {
      res.end(getDiagnosticPage(mainStatus));
    } else if (req.url === '/test') {
      res.end(JSON.stringify({
        emergency_server: true,
        port: EMERGENCY_PORT,
        main_server_status: mainStatus,
        timestamp: new Date().toISOString()
      }));
    } else {
      res.end('Serveur de secours Smart GMAO DiagFix');
    }
  });
  
  server.listen(EMERGENCY_PORT, '0.0.0.0', () => {
    console.log(`✅ Serveur de secours démarré sur le port ${EMERGENCY_PORT}`);
    console.log(`🌐 Accédez à: http://127.0.0.1:${EMERGENCY_PORT}`);
    console.log(`📊 Status serveur principal: ${mainStatus.success ? 'OK' : 'BLOQUÉ'}`);
    console.log('');
    console.log('🎯 INSTRUCTIONS:');
    console.log('1. Ouvrez votre navigateur');
    console.log(`2. Allez sur: http://127.0.0.1:${EMERGENCY_PORT}`);
    console.log('3. Suivez les instructions de diagnostic');
    console.log('');
  });
}

startEmergencyServer().catch(console.error);