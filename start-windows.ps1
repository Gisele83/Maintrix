# Script de démarrage Maintrix pour Windows
Write-Host "🚀 Démarrage de Maintrix..." -ForegroundColor Cyan

# Définir les variables d'environnement
$env:NODE_ENV = "development"

# Vérifier si la base de données existe
if (-not $env:DATABASE_URL) {
    Write-Host "⚠️  DATABASE_URL non définie, utilisation de la configuration par défaut" -ForegroundColor Yellow
}

# Démarrer le serveur
Write-Host "📡 Lancement du serveur sur le port 5000..." -ForegroundColor Green
npx tsx server/index.ts
