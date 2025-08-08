# Smart GMAO DiagFix - Installateur PowerShell
# Version 2.1.0 - Installation automatique pour Windows

param(
    [string]$InstallPath = "$env:ProgramFiles\Smart GMAO DiagFix",
    [switch]$Silent = $false
)

# Configuration
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Couleurs pour les messages
function Write-ColorText {
    param([string]$Text, [ConsoleColor]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

function Write-Success { param([string]$Text) Write-ColorText $Text "Green" }
function Write-Info { param([string]$Text) Write-ColorText $Text "Cyan" }
function Write-Warning { param([string]$Text) Write-ColorText $Text "Yellow" }
function Write-Error { param([string]$Text) Write-ColorText $Text "Red" }

# Vérifier les privilèges administrateur
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Télécharger un fichier avec barre de progression
function Download-File {
    param([string]$Url, [string]$Output)
    
    try {
        Write-Info "Téléchargement: $(Split-Path $Output -Leaf)"
        Invoke-WebRequest -Uri $Url -OutFile $Output -UseBasicParsing
        Write-Success "✓ Téléchargement terminé"
    } catch {
        Write-Error "✗ Erreur de téléchargement: $($_.Exception.Message)"
        throw
    }
}

# Installation principale
function Install-SmartGMAO {
    Clear-Host
    Write-ColorText @"
=========================================
Smart GMAO DiagFix - Installateur Windows
Version 2.1.0
=========================================
"@ "Green"

    # Vérifier les privilèges
    if (-not (Test-Administrator)) {
        Write-Error "Erreur: Cet installateur doit être exécuté en tant qu'administrateur."
        Write-Warning "Clic droit sur le fichier PowerShell et choisissez 'Exécuter en tant qu'administrateur'"
        Read-Host "Appuyez sur Entrée pour quitter"
        exit 1
    }

    Write-Info "Installation dans: $InstallPath"
    Write-Host ""

    # Étape 1: Préparation
    Write-Info "[1/9] Préparation de l'installation..."
    
    if (Test-Path $InstallPath) {
        Write-Warning "Suppression de l'ancienne installation..."
        Remove-Item $InstallPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null

    # Étape 2: Installation de Node.js
    Write-Info "[2/9] Vérification de Node.js..."
    
    try {
        $nodeVersion = node --version 2>$null
        Write-Success "✓ Node.js déjà installé: $nodeVersion"
    } catch {
        Write-Info "Installation de Node.js..."
        $nodeUrl = "https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi"
        $nodeInstaller = "$env:TEMP\nodejs-installer.msi"
        
        Download-File $nodeUrl $nodeInstaller
        
        Write-Info "Installation en cours..."
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $nodeInstaller, "/quiet", "/norestart" -Wait
        
        # Actualiser PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        Write-Success "✓ Node.js installé avec succès"
    }

    # Étape 3: Installation de PostgreSQL
    Write-Info "[3/9] Vérification de PostgreSQL..."
    
    try {
        $pgVersion = psql --version 2>$null
        Write-Success "✓ PostgreSQL déjà installé: $pgVersion"
    } catch {
        Write-Info "Installation de PostgreSQL..."
        $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-15.5-1-windows-x64.exe"
        $pgInstaller = "$env:TEMP\postgresql-installer.exe"
        
        Download-File $pgUrl $pgInstaller
        
        Write-Info "Installation en cours (cela peut prendre quelques minutes)..."
        Start-Process -FilePath $pgInstaller -ArgumentList "--mode", "unattended", "--superpassword", "postgres123", "--servicename", "postgresql", "--servicepassword", "postgres123" -Wait
        Write-Success "✓ PostgreSQL installé avec succès"
    }

    # Étape 4: Copie des fichiers
    Write-Info "[4/9] Copie des fichiers de l'application..."
    
    $sourceDir = Split-Path $PSScriptRoot -Parent
    Copy-Item "$sourceDir\*" $InstallPath -Recurse -Force -Exclude "scripts"
    Write-Success "✓ Fichiers copiés"

    # Étape 5: Installation des dépendances
    Write-Info "[5/9] Installation des dépendances npm..."
    
    Set-Location $InstallPath
    & npm install --production --silent
    Write-Success "✓ Dépendances installées"

    # Étape 6: Configuration de la base de données
    Write-Info "[6/9] Configuration de la base de données..."
    
    $envContent = @"
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/smart_gmao_diagfix
NODE_ENV=production
PORT=3000
SESSION_SECRET=smart_gmao_secret_key_2025_$(Get-Random)
"@
    
    $envContent | Out-File -FilePath "$InstallPath\.env" -Encoding UTF8
    
    # Attendre que PostgreSQL soit prêt
    Write-Info "Attente du démarrage de PostgreSQL..."
    Start-Sleep -Seconds 15
    
    # Créer la base de données
    Write-Info "Création de la base de données..."
    try {
        $createDbCommand = "CREATE DATABASE smart_gmao_diagfix;"
        $createDbCommand | & psql -U postgres -h localhost 2>$null
        Write-Success "✓ Base de données créée"
    } catch {
        Write-Warning "Base de données déjà existante ou erreur: $($_.Exception.Message)"
    }

    # Étape 7: Initialisation du schéma
    Write-Info "[7/9] Initialisation du schéma de base de données..."
    
    try {
        & npm run db:push
        Write-Success "✓ Schéma initialisé"
    } catch {
        Write-Warning "Erreur lors de l'initialisation du schéma: $($_.Exception.Message)"
    }

    # Étape 8: Configuration du service Windows
    Write-Info "[8/9] Configuration du service Windows..."
    
    # Installer node-windows
    & npm install -g node-windows --silent
    
    # Créer le script de service
    $serviceScript = @"
const { Service } = require('node-windows');

const svc = new Service({
  name: 'SmartGMAODiagFix',
  description: 'Service de maintenance industrielle intelligente Smart GMAO DiagFix',
  script: '$($InstallPath.Replace('\', '\\'))\\server\\index.js',
  env: [{
    name: 'NODE_ENV',
    value: 'production'
  }]
});

svc.on('install', function() {
  console.log('Service installé');
  svc.start();
});

svc.on('start', function() {
  console.log('Service démarré');
});

svc.install();
"@
    
    $serviceScript | Out-File -FilePath "$InstallPath\install-service.js" -Encoding UTF8
    & node "$InstallPath\install-service.js"
    Write-Success "✓ Service Windows configuré"

    # Étape 9: Création des raccourcis et finalisation
    Write-Info "[9/9] Finalisation de l'installation..."
    
    # Raccourci Bureau
    $WshShell = New-Object -comObject WScript.Shell
    $DesktopShortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Smart GMAO DiagFix.lnk")
    $DesktopShortcut.TargetPath = "http://localhost:3000"
    $DesktopShortcut.Description = "Smart GMAO DiagFix - Maintenance industrielle intelligente"
    $DesktopShortcut.Save()
    
    # Raccourci Menu Démarrer
    $StartMenuShortcut = $WshShell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Smart GMAO DiagFix.lnk")
    $StartMenuShortcut.TargetPath = "http://localhost:3000"
    $StartMenuShortcut.Description = "Smart GMAO DiagFix - Maintenance industrielle intelligente"
    $StartMenuShortcut.Save()
    
    # Configuration du pare-feu
    try {
        netsh advfirewall firewall add rule name="Smart GMAO DiagFix" dir=in action=allow protocol=TCP localport=3000 | Out-Null
        Write-Success "✓ Pare-feu configuré"
    } catch {
        Write-Warning "Impossible de configurer le pare-feu automatiquement"
    }

    # Installation terminée
    Write-Host ""
    Write-Success "======================================"
    Write-Success "INSTALLATION TERMINÉE AVEC SUCCÈS !"
    Write-Success "======================================"
    Write-Host ""
    Write-Info "Smart GMAO DiagFix est maintenant installé et configuré."
    Write-Host ""
    Write-ColorText "Accès à l'application:" "Cyan"
    Write-Host "• URL: http://localhost:3000"
    Write-Host "• Raccourci sur le Bureau créé"
    Write-Host "• Raccourci dans le Menu Démarrer créé"
    Write-Host "• Service Windows configuré et démarré"
    Write-Host ""
    Write-ColorText "Configuration de la base de données:" "Cyan"
    Write-Host "• PostgreSQL configuré automatiquement"
    Write-Host "• Base: smart_gmao_diagfix"
    Write-Host "• Port: 5432"
    Write-Host ""
    
    if (-not $Silent) {
        Write-Info "L'application va s'ouvrir automatiquement dans 5 secondes..."
        Start-Sleep -Seconds 5
        Start-Process "http://localhost:3000"
        
        Write-Success "Installation complète ! Profitez de Smart GMAO DiagFix."
        Read-Host "Appuyez sur Entrée pour fermer cet installateur"
    }
}

# Fonction de désinstallation
function Uninstall-SmartGMAO {
    Write-Info "Désinstallation de Smart GMAO DiagFix..."
    
    # Arrêter et supprimer le service
    try {
        Stop-Service -Name "SmartGMAODiagFix" -Force -ErrorAction SilentlyContinue
        & sc.exe delete "SmartGMAODiagFix" | Out-Null
        Write-Success "✓ Service supprimé"
    } catch {
        Write-Warning "Service déjà supprimé ou erreur"
    }
    
    # Supprimer les fichiers
    if (Test-Path $InstallPath) {
        Remove-Item $InstallPath -Recurse -Force
        Write-Success "✓ Fichiers supprimés"
    }
    
    # Supprimer les raccourcis
    Remove-Item "$env:USERPROFILE\Desktop\Smart GMAO DiagFix.lnk" -ErrorAction SilentlyContinue
    Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Smart GMAO DiagFix.lnk" -ErrorAction SilentlyContinue
    Write-Success "✓ Raccourcis supprimés"
    
    Write-Success "Désinstallation terminée"
}

# Point d'entrée principal
if ($args[0] -eq "uninstall") {
    Uninstall-SmartGMAO
} else {
    Install-SmartGMAO
}