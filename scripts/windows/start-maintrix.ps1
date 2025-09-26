# 🚀 Maintrix Windows - Script de Démarrage
# Démarrage sécurisé des services Maintrix sur Windows

param(
    [string]$InstallDir = "C:\Maintrix",
    [switch]$Verbose,
    [switch]$Wait
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

# Vérification de Docker
try {
    $dockerVersion = docker --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "Docker non disponible - Démarrage de Docker Desktop..." "Warning"
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        Start-Sleep 30
    }
}
catch {
    Write-ColorOutput "Erreur Docker: $($_.Exception.Message)" "Error"
    exit 1
}

# Chargement des variables d'environnement
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match "^([^#=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
    Write-ColorOutput "Variables d'environnement chargées" "Success"
}

Write-ColorOutput "Démarrage des services Maintrix..." "Info"

try {
    # Démarrage base de données
    Write-ColorOutput "Démarrage PostgreSQL..." "Info"
    docker-compose up -d maintrix-db
    
    # Attente de la disponibilité de la base
    $maxAttempts = 30
    $attempt = 0
    do {
        Start-Sleep 2
        $attempt++
        $dbStatus = docker-compose exec -T maintrix-db pg_isready -U maintrix_admin 2>$null
        if ($Verbose) {
            Write-ColorOutput "Tentative $attempt/$maxAttempts - Base de données..." "Info"
        }
    } while ($LASTEXITCODE -ne 0 -and $attempt -lt $maxAttempts)
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "PostgreSQL prêt" "Success"
    } else {
        Write-ColorOutput "Timeout base de données" "Error"
        exit 1
    }
    
    # Démarrage application
    Write-ColorOutput "Démarrage de l'application..." "Info"
    docker-compose up -d maintrix-app
    
    # Vérification santé application
    if ($Wait) {
        $maxAttempts = 60
        $attempt = 0
        do {
            Start-Sleep 3
            $attempt++
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$($env:WEB_PORT ?? '8080')/api/health" -UseBasicParsing -TimeoutSec 5 2>$null
                $appReady = $response.StatusCode -eq 200
            }
            catch {
                $appReady = $false
            }
            
            if ($Verbose) {
                Write-ColorOutput "Vérification santé $attempt/$maxAttempts..." "Info"
            }
        } while (-not $appReady -and $attempt -lt $maxAttempts)
        
        if ($appReady) {
            Write-ColorOutput "Application prête" "Success"
        } else {
            Write-ColorOutput "L'application met plus de temps à démarrer" "Warning"
        }
    }
    
    # Affichage du statut
    Write-ColorOutput "Services Maintrix démarrés avec succès" "Success"
    Write-ColorOutput "Accès: http://localhost:$($env:WEB_PORT ?? '8080')" "Info"
    
    # Statut des containers
    if ($Verbose) {
        Write-ColorOutput "Statut des containers:" "Info"
        docker-compose ps
    }
}
catch {
    Write-ColorOutput "Erreur lors du démarrage: $($_.Exception.Message)" "Error"
    exit 1
}