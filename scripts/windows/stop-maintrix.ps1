# 🛑 Maintrix Windows - Script d'Arrêt
# Arrêt sécurisé des services Maintrix sur Windows

param(
    [string]$InstallDir = "C:\Maintrix",
    [switch]$Force,
    [switch]$Backup,
    [switch]$Verbose
)

function Write-ColorOutput {
    param([string]$Message, [string]$Type = "Info")
    switch ($Type) {
        "Success" { Write-Host "[SUCCÈS] $Message" -ForegroundColor Green }
        "Error"   { Write-Host "[ERREUR] $Message" -ForegroundColor Red }
        "Warning" { Write-Host "[ATTENTION] $Message" -ForegroundColor Yellow }
        "Info"    { Write-Host "[INFO] $Message" -ForegroundColor Blue }
    }
}

# Vérification de l'installation
if (-not (Test-Path $InstallDir)) {
    Write-ColorOutput "Répertoire Maintrix non trouvé: $InstallDir" "Error"
    exit 1
}

Set-Location $InstallDir

# Sauvegarde préventive si demandée
if ($Backup) {
    Write-ColorOutput "Création d'une sauvegarde préventive..." "Info"
    try {
        & "$InstallDir\scripts\windows\backup-maintrix.ps1" -Quick
        Write-ColorOutput "Sauvegarde créée" "Success"
    }
    catch {
        Write-ColorOutput "Erreur lors de la sauvegarde: $($_.Exception.Message)" "Warning"
    }
}

Write-ColorOutput "Arrêt des services Maintrix..." "Info"

try {
    if ($Force) {
        Write-ColorOutput "Arrêt forcé en cours..." "Warning"
        docker-compose kill
        docker-compose down --remove-orphans
    } else {
        Write-ColorOutput "Arrêt gracieux en cours..." "Info"
        docker-compose down --timeout 30
    }
    
    # Vérification de l'arrêt
    $containers = docker-compose ps -q
    if ($containers) {
        Write-ColorOutput "Certains containers sont encore actifs" "Warning"
        if ($Verbose) {
            docker-compose ps
        }
    } else {
        Write-ColorOutput "Tous les services Maintrix sont arrêtés" "Success"
    }
    
    # Nettoyage optionnel
    if ($Force) {
        Write-ColorOutput "Nettoyage des containers orphelins..." "Info"
        docker container prune -f 2>$null
        docker network prune -f 2>$null
    }
}
catch {
    Write-ColorOutput "Erreur lors de l'arrêt: $($_.Exception.Message)" "Error"
    exit 1
}