#!/usr/bin/env pwsh
# 🔨 RECONSTRUCTION COMPLÈTE DOCKER MAINTRIX
# Script de reconstruction pour Windows avec code corrigé

Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║   🔨 RECONSTRUCTION DOCKER MAINTRIX (CODE CORRIGÉ)        ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# 1. ARRÊT ET NETTOYAGE
Write-Host "`n[1/6] 🛑 Arrêt et nettoyage..." -ForegroundColor Yellow
docker-compose -p maintrix-local -f docker-compose.local.yml down -v 2>$null
docker rm -f maintrix-app maintrix-db 2>$null
docker volume prune -f 2>$null

# 2. COMPILATION DU CODE CORRIGÉ
Write-Host "`n[2/6] 📦 Compilation du code TypeScript..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "   ✓ Ancien dist/ supprimé" -ForegroundColor Green
}

npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Code compilé avec succès" -ForegroundColor Green
} else {
    Write-Host "   ✗ Erreur de compilation" -ForegroundColor Red
    exit 1
}

# 3. RECONSTRUCTION DE L'IMAGE
Write-Host "`n[3/6] 🔨 Reconstruction de l'image Docker..." -ForegroundColor Yellow
docker-compose -p maintrix-local -f docker-compose.local.yml build --no-cache app 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Image Docker reconstruite" -ForegroundColor Green
} else {
    Write-Host "   ✗ Erreur de construction" -ForegroundColor Red
    exit 1
}

# 4. DÉMARRAGE
Write-Host "`n[4/6] 🚀 Démarrage des conteneurs..." -ForegroundColor Yellow
docker-compose -p maintrix-local -f docker-compose.local.yml up -d
Start-Sleep -Seconds 5

# 5. VÉRIFICATION
Write-Host "`n[5/6] 🔍 Vérification..." -ForegroundColor Yellow
$maxAttempts = 12
$attempt = 0
$success = $false

while ($attempt -lt $maxAttempts -and -not $success) {
    $attempt++
    Write-Host "   Tentative $attempt/$maxAttempts..." -NoNewline
    
    $status = docker inspect maintrix-app --format='{{.State.Status}}' 2>$null
    
    if ($status -eq "running") {
        Start-Sleep -Seconds 3
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:8080/api/health" -UseBasicParsing -TimeoutSec 5 2>$null
            Write-Host " ✓" -ForegroundColor Green
            $success = $true
        } catch {
            Write-Host " ⏳" -ForegroundColor Yellow
            Start-Sleep -Seconds 5
        }
    } else {
        Write-Host " Status: $status" -ForegroundColor Red
        Start-Sleep -Seconds 5
    }
}

# 6. RÉSULTATS
Write-Host "`n[6/6] 📊 Résultats:" -ForegroundColor Cyan
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

if ($success) {
    Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║           ✅ MAINTRIX INSTALLÉ AVEC SUCCÈS !              ║
╚═══════════════════════════════════════════════════════════╝

🌐 URL: http://localhost:8080
👤 Admin: admin@maintrix.local
🔑 Password: Maintrix2024!

"@ -ForegroundColor Green
    
    Write-Host "Ouverture du navigateur..." -ForegroundColor Cyan
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:8080"
} else {
    Write-Host @"

⚠️ L'application ne répond pas encore.

📋 Vérification des logs:
"@ -ForegroundColor Yellow
    
    docker logs maintrix-app --tail 50
    
    Write-Host "`n💡 Actions suggérées:" -ForegroundColor Cyan
    Write-Host "1. Attendez 30 secondes et testez: http://localhost:8080" -ForegroundColor White
    Write-Host "2. Consultez les logs: docker logs maintrix-app -f" -ForegroundColor White
    Write-Host "3. Vérifiez la base de données: docker logs maintrix-db" -ForegroundColor White
}
