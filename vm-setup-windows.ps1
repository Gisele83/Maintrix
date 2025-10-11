# Script de provisioning automatique Maintrix VM Windows
# Exécuté par Vagrant lors de la création de la VM

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Installation Automatique Maintrix sur Windows VM      ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# 1. Installer Chocolatey (gestionnaire de paquets Windows)
Write-Host "`n[1/7] Installation Chocolatey..." -ForegroundColor Yellow
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
try {
    if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
        Write-Host "✓ Chocolatey installé" -ForegroundColor Green
    } else {
        Write-Host "✓ Chocolatey déjà installé" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Erreur installation Chocolatey: $_" -ForegroundColor Red
}

# 2. Installer Node.js
Write-Host "`n[2/7] Installation Node.js 20..." -ForegroundColor Yellow
try {
    if (!(Get-Command node -ErrorAction SilentlyContinue)) {
        choco install nodejs-lts -y --version=20.11.0
        refreshenv
        Write-Host "✓ Node.js installé" -ForegroundColor Green
    } else {
        Write-Host "✓ Node.js déjà installé: $(node --version)" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Erreur installation Node.js: $_" -ForegroundColor Red
}

# 3. Installer PostgreSQL
Write-Host "`n[3/7] Installation PostgreSQL 15..." -ForegroundColor Yellow
try {
    if (!(Get-Command psql -ErrorAction SilentlyContinue)) {
        choco install postgresql15 -y --params '/Password:Maintrix2024!'
        refreshenv
        Write-Host "✓ PostgreSQL installé" -ForegroundColor Green
    } else {
        Write-Host "✓ PostgreSQL déjà installé" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Erreur installation PostgreSQL: $_" -ForegroundColor Red
}

# 4. Installer Git
Write-Host "`n[4/7] Installation Git..." -ForegroundColor Yellow
try {
    if (!(Get-Command git -ErrorAction SilentlyContinue)) {
        choco install git -y
        refreshenv
        Write-Host "✓ Git installé" -ForegroundColor Green
    } else {
        Write-Host "✓ Git déjà installé" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Erreur installation Git: $_" -ForegroundColor Red
}

# 5. Configurer PostgreSQL
Write-Host "`n[5/7] Configuration PostgreSQL..." -ForegroundColor Yellow
try {
    $env:PGPASSWORD = "Maintrix2024!"
    
    # Créer la base de données
    & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "CREATE DATABASE maintrix;" 2>$null
    
    # Créer l'utilisateur
    & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "CREATE USER maintrix_user WITH PASSWORD 'Maintrix2024!';" 2>$null
    & "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE maintrix TO maintrix_user;" 2>$null
    
    Write-Host "✓ Base de données 'maintrix' créée" -ForegroundColor Green
} catch {
    Write-Host "✗ Erreur configuration PostgreSQL: $_" -ForegroundColor Red
}

# 6. Installer les dépendances Maintrix
Write-Host "`n[6/7] Installation dépendances Maintrix..." -ForegroundColor Yellow
try {
    Set-Location C:\maintrix
    
    if (Test-Path "package.json") {
        npm install --loglevel=error
        Write-Host "✓ Dépendances npm installées" -ForegroundColor Green
    } else {
        Write-Host "⚠ package.json introuvable" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Erreur installation dépendances: $_" -ForegroundColor Red
}

# 7. Créer le fichier .env
Write-Host "`n[7/7] Configuration environnement..." -ForegroundColor Yellow
try {
    $envContent = @"
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://maintrix_user:Maintrix2024!@localhost:5432/maintrix
SESSION_SECRET=$(New-Guid)
"@
    
    $envContent | Out-File -FilePath "C:\maintrix\.env" -Encoding utf8
    Write-Host "✓ Fichier .env créé" -ForegroundColor Green
} catch {
    Write-Host "✗ Erreur création .env: $_" -ForegroundColor Red
}

# 8. Synchroniser le schéma de base de données
Write-Host "`n[8/8] Synchronisation schéma base de données..." -ForegroundColor Yellow
try {
    Set-Location C:\maintrix
    npm run db:push -- --force 2>$null
    Write-Host "✓ Schéma base de données synchronisé" -ForegroundColor Green
} catch {
    Write-Host "⚠ Synchronisation schéma (sera fait au premier démarrage)" -ForegroundColor Yellow
}

# 9. Créer le service Windows pour auto-démarrage
Write-Host "`n[9/9] Configuration service Windows..." -ForegroundColor Yellow
try {
    $serviceName = "MaintrixService"
    $serviceExists = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    
    if (!$serviceExists) {
        # Créer un script de démarrage
        $startScript = @"
cd C:\maintrix
`$env:NODE_ENV = "production"
node dist/index.js
"@
        $startScript | Out-File -FilePath "C:\maintrix\start-service.ps1" -Encoding utf8
        
        # Installer NSSM (Non-Sucking Service Manager)
        choco install nssm -y
        refreshenv
        
        # Créer le service
        nssm install $serviceName powershell.exe "-ExecutionPolicy Bypass -File C:\maintrix\start-service.ps1"
        nssm set $serviceName AppDirectory C:\maintrix
        nssm set $serviceName DisplayName "Maintrix GMAO Service"
        nssm set $serviceName Description "Service de gestion de maintenance industrielle Maintrix"
        nssm set $serviceName Start SERVICE_AUTO_START
        
        Write-Host "✓ Service Windows configuré (démarrage automatique)" -ForegroundColor Green
    } else {
        Write-Host "✓ Service Windows déjà configuré" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Service Windows non configuré (démarrage manuel requis)" -ForegroundColor Yellow
}

# 10. Compiler le projet
Write-Host "`n[10/10] Compilation du projet..." -ForegroundColor Yellow
try {
    Set-Location C:\maintrix
    npm run build 2>$null
    Write-Host "✓ Projet compilé" -ForegroundColor Green
} catch {
    Write-Host "⚠ Compilation échouée (sera fait au premier démarrage)" -ForegroundColor Yellow
}

# Afficher le résumé
Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           ✓ INSTALLATION MAINTRIX TERMINÉE               ║" -ForegroundColor Green
Write-Host "╟───────────────────────────────────────────────────────────╢" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "║  Démarrer manuellement:                                   ║" -ForegroundColor Green
Write-Host "║    cd C:\maintrix                                         ║" -ForegroundColor Green
Write-Host "║    npm run dev                                            ║" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "║  Ou démarrer le service:                                  ║" -ForegroundColor Green
Write-Host "║    Start-Service MaintrixService                          ║" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "║  Accès:      http://localhost:5000                        ║" -ForegroundColor Green
Write-Host "║  Identifiant: admin@maintrix.local                        ║" -ForegroundColor Green
Write-Host "║  Mot de passe: Maintrix2024!                              ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
