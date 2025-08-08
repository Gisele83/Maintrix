#!/usr/bin/env node

const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

console.log('🚀 Smart GMAO DiagFix - Serveur Alternative');
console.log('==========================================');

const app = express();
const PORT = process.env.PORT || 8080;

// Configuration pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../client')));

// Proxy pour l'API si le serveur principal fonctionne
const apiProxy = createProxyMiddleware({
  target: 'http://localhost:5000',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  },
  onError: (err, req, res) => {
    console.log('❌ Serveur principal inaccessible, mode dégradé activé');
    res.status(503).json({
      error: 'Service temporairement indisponible',
      message: 'Le serveur principal est inaccessible. Veuillez réessayer plus tard.',
      suggestions: [
        'Vérifiez que le serveur principal est démarré',
        'Contrôlez votre pare-feu et antivirus',
        'Essayez avec un autre navigateur',
        'Utilisez la version cloud sur Replit'
      ]
    });
  }
});

// Routes API avec proxy vers le serveur principal
app.use('/api', apiProxy);

// Page d'erreur personnalisée
app.get('/diagnostic', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Smart GMAO DiagFix - Diagnostic</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .status { padding: 15px; margin: 15px 0; border-radius: 5px; }
            .error { background: #ffe6e6; border-left: 4px solid #ff4444; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; }
            .success { background: #d4edda; border-left: 4px solid #28a745; }
            .info { background: #d6eaff; border-left: 4px solid #007bff; }
            h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; }
            code { background: #f8f9fa; padding: 2px 6px; border-radius: 3px; }
            .btn { display: inline-block; padding: 10px 20px; margin: 10px 5px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
            .btn:hover { background: #0056b3; }
            ul { line-height: 1.6; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔍 Smart GMAO DiagFix - Diagnostic d'Accès</h1>
            
            <div class="status error">
                <strong>❌ Problème Détecté:</strong> Le serveur principal (localhost:5000) n'est pas accessible
            </div>
            
            <div class="status info">
                <strong>ℹ️ Serveur Alternative:</strong> Vous utilisez actuellement le serveur de secours sur le port ${PORT}
            </div>
            
            <h2>🛠️ Solutions Recommandées</h2>
            
            <div class="status warning">
                <strong>1. Vérifications de Base:</strong>
                <ul>
                    <li>Assurez-vous que le serveur principal est démarré</li>
                    <li>Vérifiez votre pare-feu Windows</li>
                    <li>Contrôlez les paramètres de votre antivirus</li>
                    <li>Essayez avec un autre navigateur</li>
                </ul>
            </div>
            
            <div class="status warning">
                <strong>2. Alternatives d'Accès:</strong>
                <ul>
                    <li>Essayez <code>http://127.0.0.1:5000</code> au lieu de localhost</li>
                    <li>Lancez votre navigateur en mode administrateur</li>
                    <li>Désactivez temporairement votre proxy</li>
                </ul>
            </div>
            
            <div class="status success">
                <strong>3. Version Cloud (Recommandée):</strong>
                <ul>
                    <li>Utilisez directement Smart GMAO DiagFix sur Replit</li>
                    <li>Aucune installation locale requise</li>
                    <li>Accès immédiat et sécurisé</li>
                </ul>
            </div>
            
            <h2>🔗 Liens Utiles</h2>
            <a href="http://localhost:5000" class="btn">Réessayer localhost:5000</a>
            <a href="http://127.0.0.1:5000" class="btn">Essayer 127.0.0.1:5000</a>
            <a href="javascript:location.reload()" class="btn">Actualiser cette page</a>
            
            <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 5px;">
                <h3>📞 Support Technique</h3>
                <p>Si le problème persiste, voici les informations à communiquer :</p>
                <ul>
                    <li><strong>Système:</strong> ${process.platform}</li>
                    <li><strong>Node.js:</strong> ${process.version}</li>
                    <li><strong>Port alternatif:</strong> ${PORT}</li>
                    <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
                </ul>
            </div>
        </div>
        
        <script>
            // Test automatique du serveur principal
            setTimeout(() => {
                fetch('http://localhost:5000/api/health')
                    .then(response => {
                        if (response.ok) {
                            document.body.insertAdjacentHTML('afterbegin', 
                                '<div style="position: fixed; top: 0; left: 0; right: 0; background: #28a745; color: white; padding: 10px; text-align: center; z-index: 1000;">' +
                                '✅ Serveur principal récupéré ! <a href="http://localhost:5000" style="color: white; text-decoration: underline;">Cliquez ici pour y accéder</a>' +
                                '</div>'
                            );
                        }
                    })
                    .catch(() => {
                        // Serveur toujours inaccessible
                    });
            }, 2000);
        </script>
    </body>
    </html>
  `);
});

// Route par défaut
app.get('*', (req, res) => {
  res.redirect('/diagnostic');
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err.message);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: err.message
  });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur alternatif démarré sur le port ${PORT}`);
  console.log(`🌐 Accès: http://localhost:${PORT}`);
  console.log(`🔍 Diagnostic: http://localhost:${PORT}/diagnostic`);
  console.log('');
  console.log('💡 Ce serveur sert de solution de secours');
  console.log('   si le serveur principal (port 5000) est inaccessible');
});