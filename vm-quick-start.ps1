# Script de démarrage rapide Maintrix VM
# Détecte automatiquement la meilleure méthode de déploiement

param(
    [ValidateSet("vagrant", "hyperv", "docker", "auto")]
    [string]$Method = "auto"
)

Write-Host @"
╔═══════════════════════════════════════════════════════════╗
║          🔧 MAINTRIX VM - DÉMARRAGE RAPIDE                 ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan

# Fonction de détection automatique
function Get-BestMethod {
    # Vérifier Vagrant
    if (Get-Command vagrant -ErrorAction SilentlyContinue) {
        return "vagrant"
    }
    
    # Vérifier Hyper-V
    $hyperv = Get-WindowsOptionalFeature -FeatureName Microsoft-Hyper-V-All -Online -ErrorAction SilentlyContinue
    if ($hyperv -and $hyperv.State -eq "Enabled") {
        return "hyperv"
    }
    
    # Vérifier Docker
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        return "docker"
    }
    
    return "none"
}

# Déterminer la méthode
if ($Method -eq "auto") {
    $Method = Get-BestMethod
    Write-Host "`n✓ Méthode détectée automatiquement: $Method" -ForegroundColor Green
}

# Exécuter selon la méthode
switch ($Method) {
    "vagrant" {
        Write-Host "`n[VAGRANT] Démarrage de la VM avec Vagrant..." -ForegroundColor Yellow
        
        # Vérifier VirtualBox
        if (!(Get-Command VBoxManage -ErrorAction SilentlyContinue)) {
            Write-Host "✗ VirtualBox n'est pas installé" -ForegroundColor Red
            Write-Host "  Installer: choco install virtualbox -y" -ForegroundColor Yellow
            exit 1
        }
        
        # Démarrer Vagrant
        Write-Host "`nDémarrage de la VM (peut prendre 10-20 min au premier lancement)..." -ForegroundColor Cyan
        vagrant up
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║              ✓ VM VAGRANT DÉMARRÉE                        ║
╟───────────────────────────────────────────────────────────╢
║  Accès Web:     http://localhost:5000                     ║
║  Email:         admin@maintrix.local                      ║
║  Mot de passe:  Maintrix2024!                             ║
║                                                           ║
║  Se connecter:  vagrant ssh                              ║
║  Arrêter:       vagrant halt                             ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green
        }
    }
    
    "hyperv" {
        Write-Host "`n[HYPER-V] Création et démarrage de la VM..." -ForegroundColor Yellow
        
        # Vérifier droits admin
        if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
            Write-Host "✗ Droits administrateur requis pour Hyper-V" -ForegroundColor Red
            Write-Host "  Relancer en tant qu'Administrateur" -ForegroundColor Yellow
            exit 1
        }
        
        # Lancer le script de création Hyper-V
        .\vm-hyperv-create.ps1
    }
    
    "docker" {
        Write-Host "`n[DOCKER] Démarrage avec Docker Compose..." -ForegroundColor Yellow
        
        # Vérifier que Docker est lancé
        $dockerStatus = docker info 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ Docker n'est pas démarré" -ForegroundColor Red
            Write-Host "  Lancer Docker Desktop puis réessayer" -ForegroundColor Yellow
            exit 1
        }
        
        # Démarrer avec Docker Compose
        Write-Host "`nDémarrage des conteneurs..." -ForegroundColor Cyan
        docker-compose -f docker-compose.vm.yml up -d
        
        if ($LASTEXITCODE -eq 0) {
            Start-Sleep -Seconds 5
            
            Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║            ✓ CONTENEURS DOCKER DÉMARRÉS                   ║
╟───────────────────────────────────────────────────────────╢
║  Maintrix:      http://localhost:5000                     ║
║  pgAdmin:       http://localhost:5050                     ║
║  Email:         admin@maintrix.local                      ║
║  Mot de passe:  Maintrix2024!                             ║
║                                                           ║
║  Voir logs:     docker-compose logs -f                    ║
║  Arrêter:       docker-compose down                       ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green
        }
    }
    
    "none" {
        Write-Host @"

╔═══════════════════════════════════════════════════════════╗
║              ⚠ AUCUNE MÉTHODE DÉTECTÉE                    ║
╟───────────────────────────────────────────────────────────╢
║  Installer une des solutions suivantes:                   ║
║                                                           ║
║  1. VAGRANT + VIRTUALBOX (Recommandé)                     ║
║     choco install vagrant virtualbox -y                   ║
║                                                           ║
║  2. HYPER-V (Windows Pro/Enterprise)                      ║
║     Enable-WindowsOptionalFeature -Online \               ║
║       -FeatureName Microsoft-Hyper-V-All                  ║
║                                                           ║
║  3. DOCKER DESKTOP                                        ║
║     choco install docker-desktop -y                       ║
║                                                           ║
║  Puis relancer: .\vm-quick-start.ps1                      ║
╚═══════════════════════════════════════════════════════════╝
"@ -ForegroundColor Yellow
    }
}

# Ouvrir le navigateur après 10 secondes (si succès)
if ($Method -ne "none" -and $LASTEXITCODE -eq 0) {
    Write-Host "`n⏳ Attente du démarrage de l'application (10 sec)..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10
    
    # Tester la connexion
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "✓ Application accessible!" -ForegroundColor Green
            Start-Process "http://localhost:5000"
        }
    } catch {
        Write-Host "⚠ Application non encore accessible (attendre 1-2 min)" -ForegroundColor Yellow
        Write-Host "  Puis ouvrir: http://localhost:5000" -ForegroundColor Cyan
    }
}
