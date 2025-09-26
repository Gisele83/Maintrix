# 🚀 MAINTRIX - Script d'Installation Automatique Windows
# Installation complète du progiciel Maintrix sur Windows avec WSL2
# Compatibilité: Windows 10/11 Home/Pro/Enterprise/Education

#Requires -RunAsAdministrator

param(
    [string]$WebPort = "8080",
    [string]$DomainName = "",
    [string]$DbPassword = "",
    [string]$InstallDir = "C:\Maintrix",
    [switch]$Help,
    [switch]$Version,
    [switch]$Uninstall,
    [switch]$SkipWSL,
    [switch]$Verbose
)

# =================================
# VARIABLES DE CONFIGURATION
# =================================
$MAINTRIX_VERSION = "2.0.0"
$WSL_DISTRO = "Ubuntu-22.04"
$DOCKER_DESKTOP_URL = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"

# =================================
# FONCTIONS UTILITAIRES
# =================================
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )
    
    switch ($Type) {
        "Success" { Write-Host "[SUCCÈS] $Message" -ForegroundColor Green }
        "Error"   { Write-Host "[ERREUR] $Message" -ForegroundColor Red }
        "Warning" { Write-Host "[AVERTISSEMENT] $Message" -ForegroundColor Yellow }
        "Info"    { Write-Host "[INFO] $Message" -ForegroundColor Blue }
        default   { Write-Host $Message }
    }
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$currentUser
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-WindowsVersion {
    $version = [System.Environment]::OSVersion.Version
    $build = [System.Environment]::OSVersion.Version.Build
    
    if ($version.Major -lt 10) {
        Write-ColorOutput "Windows 10 ou supérieur requis. Version détectée: $($version.ToString())" "Error"
        return $false
    }
    
    if ($version.Major -eq 10 -and $build -lt 19041) {
        Write-ColorOutput "Windows 10 build 19041 ou supérieur requis pour WSL2. Build détecté: $build" "Error"
        return $false
    }
    
    Write-ColorOutput "Version Windows compatible: $($version.ToString()) (Build $build)" "Success"
    return $true
}

function Test-SystemRequirements {
    Write-ColorOutput "Vérification des prérequis système..." "Info"
    
    # Vérification de la mémoire RAM (minimum 4GB)
    $totalMemory = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
    $memoryGB = [math]::Round($totalMemory / 1GB, 2)
    
    if ($memoryGB -lt 4) {
        Write-ColorOutput "Mémoire RAM insuffisante: ${memoryGB}GB. Minimum requis: 4GB" "Error"
        return $false
    }
    
    # Vérification de l'espace disque (minimum 20GB)
    $diskSpace = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object @{Name="FreeSpaceGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
    
    if ($diskSpace.FreeSpaceGB -lt 20) {
        Write-ColorOutput "Espace disque insuffisant: $($diskSpace.FreeSpaceGB)GB. Minimum requis: 20GB" "Error"
        return $false
    }
    
    # Vérification de la virtualisation
    $hyperv = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
    $vmPlatform = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
    
    Write-ColorOutput "RAM: ${memoryGB}GB | Disque: $($diskSpace.FreeSpaceGB)GB | Hyper-V: $($hyperv.State) | VM Platform: $($vmPlatform.State)" "Success"
    return $true
}

# =================================
# INSTALLATION WSL2
# =================================
function Install-WSL2 {
    Write-ColorOutput "Configuration de WSL2..." "Info"
    
    # Vérification si WSL est déjà installé
    $wslVersion = wsl --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "WSL déjà installé" "Success"
        return $true
    }
    
    try {
        # Installation des fonctionnalités Windows
        Write-ColorOutput "Activation des fonctionnalités Windows..." "Info"
        
        Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
        Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
        
        # Installation du kernel WSL2
        Write-ColorOutput "Téléchargement du kernel WSL2..." "Info"
        $kernelUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
        $kernelPath = "$env:TEMP\wsl_update_x64.msi"
        
        Invoke-WebRequest -Uri $kernelUrl -OutFile $kernelPath
        Start-Process msiexec.exe -Wait -ArgumentList "/I $kernelPath /quiet"
        
        # Configuration WSL2 par défaut
        wsl --set-default-version 2
        
        Write-ColorOutput "WSL2 installé avec succès" "Success"
        Write-ColorOutput "REDÉMARRAGE REQUIS - Relancez ce script après redémarrage" "Warning"
        
        $restart = Read-Host "Redémarrer maintenant? (O/n)"
        if ($restart -ne "n" -and $restart -ne "N") {
            Restart-Computer
        }
        
        return $false  # Installation incomplète jusqu'au redémarrage
    }
    catch {
        Write-ColorOutput "Erreur lors de l'installation WSL2: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Install-UbuntuWSL {
    Write-ColorOutput "Installation d'Ubuntu sur WSL2..." "Info"
    
    # Vérification si Ubuntu est déjà installé
    $distros = wsl -l -v
    if ($distros -match "Ubuntu") {
        Write-ColorOutput "Ubuntu déjà installé sur WSL" "Success"
        return $true
    }
    
    try {
        # Installation via Windows Store
        Write-ColorOutput "Installation d'Ubuntu-22.04..." "Info"
        wsl --install -d Ubuntu-22.04
        
        Write-ColorOutput "Configuration d'Ubuntu..." "Info"
        Write-ColorOutput "ATTENTION: Une fenêtre Ubuntu va s'ouvrir pour la configuration initiale" "Warning"
        Write-ColorOutput "Créez un nom d'utilisateur et mot de passe Linux" "Info"
        
        # Lancement pour configuration initiale
        Start-Process wsl -ArgumentList "-d Ubuntu-22.04"
        
        Read-Host "Appuyez sur Entrée une fois Ubuntu configuré"
        
        return $true
    }
    catch {
        Write-ColorOutput "Erreur lors de l'installation Ubuntu: $($_.Exception.Message)" "Error"
        return $false
    }
}

# =================================
# INSTALLATION DOCKER DESKTOP
# =================================
function Install-DockerDesktop {
    Write-ColorOutput "Installation de Docker Desktop..." "Info"
    
    # Vérification si Docker est déjà installé
    $dockerPath = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerPath) {
        Write-ColorOutput "Docker déjà installé" "Success"
        return $true
    }
    
    try {
        # Téléchargement Docker Desktop
        Write-ColorOutput "Téléchargement de Docker Desktop..." "Info"
        $dockerInstaller = "$env:TEMP\DockerDesktopInstaller.exe"
        
        $progressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $DOCKER_DESKTOP_URL -OutFile $dockerInstaller
        $progressPreference = 'Continue'
        
        # Installation silencieuse
        Write-ColorOutput "Installation de Docker Desktop (peut prendre quelques minutes)..." "Info"
        Start-Process $dockerInstaller -Wait -ArgumentList "install --quiet --accept-license --backend=wsl-2"
        
        Write-ColorOutput "Docker Desktop installé avec succès" "Success"
        Write-ColorOutput "REDÉMARRAGE REQUIS - Relancez ce script après redémarrage" "Warning"
        
        return $false  # Installation incomplète jusqu'au redémarrage
    }
    catch {
        Write-ColorOutput "Erreur lors de l'installation Docker Desktop: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Test-DockerRunning {
    Write-ColorOutput "Vérification de Docker..." "Info"
    
    try {
        $dockerVersion = docker --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Docker disponible: $dockerVersion" "Success"
            return $true
        }
    }
    catch {
        Write-ColorOutput "Docker non disponible" "Error"
        return $false
    }
    
    # Tentative de démarrage de Docker Desktop
    Write-ColorOutput "Démarrage de Docker Desktop..." "Info"
    $dockerDesktop = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
    if (-not $dockerDesktop) {
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        Start-Sleep 30
    }
    
    # Nouvelle vérification
    try {
        $dockerVersion = docker --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "Docker démarré avec succès" "Success"
            return $true
        }
    }
    catch {
        Write-ColorOutput "Impossible de démarrer Docker" "Error"
        return $false
    }
    
    return $false
}

# =================================
# CONFIGURATION MAINTRIX
# =================================
function Initialize-MaintrixDirectories {
    Write-ColorOutput "Création des répertoires Maintrix..." "Info"
    
    try {
        $directories = @(
            $InstallDir,
            "$InstallDir\data",
            "$InstallDir\data\postgres", 
            "$InstallDir\data\uploads",
            "$InstallDir\data\logs",
            "$InstallDir\config",
            "$InstallDir\backups",
            "$InstallDir\scripts",
            "$InstallDir\logs"
        )
        
        foreach ($dir in $directories) {
            if (-not (Test-Path $dir)) {
                New-Item -Path $dir -ItemType Directory -Force | Out-Null
            }
        }
        
        Write-ColorOutput "Répertoires créés avec succès" "Success"
        return $true
    }
    catch {
        Write-ColorOutput "Erreur lors de la création des répertoires: $($_.Exception.Message)" "Error"
        return $false
    }
}

function New-SecurePasswords {
    Write-ColorOutput "Génération des mots de passe sécurisés..." "Info"
    
    if ([string]::IsNullOrEmpty($DbPassword)) {
        $bytes = New-Object Byte[] 32
        ([System.Security.Cryptography.RNGCryptoServiceProvider]::Create()).GetBytes($bytes)
        $script:DbPassword = [System.Convert]::ToBase64String($bytes) -replace '[^a-zA-Z0-9]', '' | Select-Object -First 25
    }
    
    $bytes = New-Object Byte[] 64
    ([System.Security.Cryptography.RNGCryptoServiceProvider]::Create()).GetBytes($bytes)
    $script:SessionSecret = [System.Convert]::ToBase64String($bytes) -replace '[^a-zA-Z0-9]', '' | Select-Object -First 50
    
    Write-ColorOutput "Mots de passe générés avec succès" "Success"
}

function New-EnvironmentFile {
    Write-ColorOutput "Création du fichier de configuration..." "Info"
    
    $envContent = @"
# =================================
# MAINTRIX - Configuration Windows
# =================================

# Version
MAINTRIX_VERSION=$MAINTRIX_VERSION

# Base de données
DB_PASSWORD=$DbPassword

# Sécurité
SESSION_SECRET=$SessionSecret

# Ports
WEB_PORT=$WebPort
DB_PORT=5433
PROXY_PORT=80

# Domaine (optionnel)
DOMAIN_NAME=$DomainName

# Installation Windows
WINDOWS_DEPLOYMENT=true
LOCAL_DEPLOYMENT=true
DISABLE_TELEMETRY=true
DISABLE_ANALYTICS=true

# Sauvegarde
BACKUP_SCHEDULE=0 2 * * *

# APIs optionnelles (à configurer selon besoins)
# ANTHROPIC_API_KEY=sk-ant-xxxxx
# SENDGRID_API_KEY=SG.xxxxx

# Monitoring (désactivé par défaut)
ENABLE_MONITORING=false
"@
    
    try {
        $envPath = "$InstallDir\.env.local"
        $envContent | Out-File -FilePath $envPath -Encoding UTF8
        
        # Sécurisation du fichier
        $acl = Get-Acl $envPath
        $acl.SetAccessRuleProtection($true, $false)
        $acl.SetAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($env:USERNAME, "FullControl", "Allow")))
        Set-Acl $envPath $acl
        
        Write-ColorOutput "Configuration sauvegardée: $envPath" "Success"
        return $true
    }
    catch {
        Write-ColorOutput "Erreur lors de la création du fichier de configuration: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Copy-MaintrixFiles {
    Write-ColorOutput "Copie des fichiers Maintrix..." "Info"
    
    try {
        # Vérification des fichiers sources
        $requiredFiles = @(
            "docker-compose.local.yml",
            "Dockerfile"
        )
        
        foreach ($file in $requiredFiles) {
            if (-not (Test-Path $file)) {
                Write-ColorOutput "Fichier requis manquant: $file" "Error"
                return $false
            }
        }
        
        # Copie des fichiers de déploiement
        Copy-Item "docker-compose.local.yml" "$InstallDir\docker-compose.yml"
        Copy-Item "Dockerfile" "$InstallDir\"
        
        # Copie du code source si disponible
        $sourceDirs = @("client", "server", "shared")
        $sourceFiles = @("package*.json", "tsconfig.json", "vite.config.ts", "tailwind.config.ts", "postcss.config.js", "drizzle.config.ts", "components.json")
        
        $allSourcesExist = $true
        foreach ($dir in $sourceDirs) {
            if (-not (Test-Path $dir)) {
                $allSourcesExist = $false
                break
            }
        }
        
        if ($allSourcesExist) {
            foreach ($dir in $sourceDirs) {
                Copy-Item $dir "$InstallDir\" -Recurse -Force
            }
            
            foreach ($pattern in $sourceFiles) {
                Get-ChildItem $pattern -ErrorAction SilentlyContinue | Copy-Item -Destination $InstallDir
            }
            
            # Copie des assets optionnels
            if (Test-Path "attached_assets") {
                Copy-Item "attached_assets" "$InstallDir\" -Recurse -Force
            }
            if (Test-Path "mobile") {
                Copy-Item "mobile" "$InstallDir\" -Recurse -Force
            }
            
            Write-ColorOutput "Code source copié avec succès" "Success"
        }
        else {
            Write-ColorOutput "Code source non trouvé - installation depuis fichiers de déploiement uniquement" "Warning"
        }
        
        return $true
    }
    catch {
        Write-ColorOutput "Erreur lors de la copie des fichiers: $($_.Exception.Message)" "Error"
        return $false
    }
}

# =================================
# DÉMARRAGE MAINTRIX
# =================================
function Start-MaintrixServices {
    Write-ColorOutput "Démarrage des services Maintrix..." "Info"
    
    try {
        Set-Location $InstallDir
        
        # Construction des images
        Write-ColorOutput "Construction des images Docker..." "Info"
        docker-compose build --no-cache
        
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "Erreur lors de la construction des images" "Error"
            return $false
        }
        
        # Démarrage de la base de données
        Write-ColorOutput "Démarrage de la base de données..." "Info"
        docker-compose up -d maintrix-db
        
        Start-Sleep 30  # Attente du démarrage de PostgreSQL
        
        # Démarrage de l'application
        Write-ColorOutput "Démarrage de l'application..." "Info"
        docker-compose up -d maintrix-app
        
        Start-Sleep 60  # Attente du démarrage complet
        
        Write-ColorOutput "Services Maintrix démarrés avec succès" "Success"
        return $true
    }
    catch {
        Write-ColorOutput "Erreur lors du démarrage: $($_.Exception.Message)" "Error"
        return $false
    }
}

# =================================
# SCRIPTS DE GESTION WINDOWS
# =================================
function New-ManagementScripts {
    Write-ColorOutput "Création des scripts de gestion Windows..." "Info"
    
    # Script de démarrage PowerShell
    $startScript = @"
# Démarrage Maintrix
Set-Location "$InstallDir"
docker-compose up -d
Write-Host "Maintrix démarré - Accessible sur http://localhost:$WebPort" -ForegroundColor Green
"@
    
    # Script d'arrêt PowerShell
    $stopScript = @"
# Arrêt Maintrix
Set-Location "$InstallDir"
docker-compose down
Write-Host "Maintrix arrêté" -ForegroundColor Yellow
"@
    
    # Script de sauvegarde PowerShell
    $backupScript = @"
# Sauvegarde Maintrix
Set-Location "$InstallDir"
`$backupFile = "maintrix_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
docker-compose exec -T maintrix-db pg_dump -U maintrix_admin maintrix_local | Out-File "backups\`$backupFile"
Write-Host "Sauvegarde créée: backups\`$backupFile" -ForegroundColor Green
"@
    
    # Script de logs PowerShell
    $logsScript = @"
# Logs Maintrix
Set-Location "$InstallDir"
docker-compose logs -f maintrix-app
"@
    
    # Script de mise à jour PowerShell
    $updateScript = @"
# Mise à jour Maintrix
Set-Location "$InstallDir"
Write-Host "Arrêt de Maintrix..." -ForegroundColor Yellow
docker-compose down
Write-Host "Mise à jour des images..." -ForegroundColor Blue
docker-compose pull
docker-compose build --no-cache
Write-Host "Redémarrage..." -ForegroundColor Blue
docker-compose up -d
Write-Host "Mise à jour terminée" -ForegroundColor Green
"@
    
    try {
        $startScript | Out-File "$InstallDir\scripts\start-maintrix.ps1" -Encoding UTF8
        $stopScript | Out-File "$InstallDir\scripts\stop-maintrix.ps1" -Encoding UTF8
        $backupScript | Out-File "$InstallDir\scripts\backup-maintrix.ps1" -Encoding UTF8
        $logsScript | Out-File "$InstallDir\scripts\logs-maintrix.ps1" -Encoding UTF8
        $updateScript | Out-File "$InstallDir\scripts\update-maintrix.ps1" -Encoding UTF8
        
        Write-ColorOutput "Scripts de gestion créés avec succès" "Success"
        return $true
    }
    catch {
        Write-ColorOutput "Erreur lors de la création des scripts: $($_.Exception.Message)" "Error"
        return $false
    }
}

# =================================
# VÉRIFICATIONS POST-INSTALLATION
# =================================
function Test-MaintrixInstallation {
    Write-ColorOutput "Vérification de l'installation..." "Info"
    
    try {
        Set-Location $InstallDir
        
        # Vérification des conteneurs
        $containers = docker-compose ps
        if ($containers -match "Up") {
            Write-ColorOutput "Conteneurs démarrés avec succès" "Success"
        }
        else {
            Write-ColorOutput "Problème de démarrage des conteneurs" "Error"
            return $false
        }
        
        # Test de connectivité
        Start-Sleep 10
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$WebPort/api/health" -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -eq 200) {
                Write-ColorOutput "Application accessible et fonctionnelle" "Success"
                return $true
            }
        }
        catch {
            Write-ColorOutput "Application non accessible - peut nécessiter plus de temps" "Warning"
        }
        
        return $true
    }
    catch {
        Write-ColorOutput "Erreur lors de la vérification: $($_.Exception.Message)" "Error"
        return $false
    }
}

# =================================
# RAPPORT D'INSTALLATION
# =================================
function Show-InstallationReport {
    Write-Host ""
    Write-ColorOutput "====================================" "Success"
    Write-ColorOutput "  MAINTRIX INSTALLÉ AVEC SUCCÈS" "Success"
    Write-ColorOutput "====================================" "Success"
    Write-Host ""
    
    Write-ColorOutput "🌐 URL d'accès: http://localhost:$WebPort" "Info"
    if (![string]::IsNullOrEmpty($DomainName)) {
        Write-ColorOutput "🌐 Domaine: http://$DomainName" "Info"
    }
    Write-Host ""
    
    Write-ColorOutput "📋 Informations système:" "Info"
    Write-ColorOutput "   Répertoire: $InstallDir" "Info"
    Write-ColorOutput "   Configuration: $InstallDir\.env.local" "Info"
    Write-ColorOutput "   Logs: docker-compose logs -f" "Info"
    Write-Host ""
    
    Write-ColorOutput "🛠️ Scripts de gestion PowerShell:" "Info"
    Write-ColorOutput "   Démarrer: $InstallDir\scripts\start-maintrix.ps1" "Info"
    Write-ColorOutput "   Arrêter: $InstallDir\scripts\stop-maintrix.ps1" "Info"
    Write-ColorOutput "   Sauvegarder: $InstallDir\scripts\backup-maintrix.ps1" "Info"
    Write-ColorOutput "   Mettre à jour: $InstallDir\scripts\update-maintrix.ps1" "Info"
    Write-ColorOutput "   Voir les logs: $InstallDir\scripts\logs-maintrix.ps1" "Info"
    Write-Host ""
    
    Write-ColorOutput "🔑 Identifiants par défaut:" "Info"
    Write-ColorOutput "   Utilisateur: admin@maintrix.local" "Info"
    Write-ColorOutput "   Mot de passe: Maintrix2024!" "Info"
    Write-Host ""
    
    Write-ColorOutput "⚠️  Changez le mot de passe par défaut lors de la première connexion" "Warning"
    Write-Host ""
    
    Write-ColorOutput "📚 Documentation Windows: $InstallDir\INSTALLATION_WINDOWS_GUIDE.md" "Info"
}

# =================================
# DÉSINSTALLATION
# =================================
function Uninstall-Maintrix {
    Write-ColorOutput "Désinstallation de Maintrix..." "Warning"
    
    $confirm = Read-Host "Êtes-vous sûr de vouloir désinstaller Maintrix? (oui/non)"
    if ($confirm -ne "oui") {
        Write-ColorOutput "Désinstallation annulée" "Info"
        return
    }
    
    try {
        if (Test-Path $InstallDir) {
            Set-Location $InstallDir
            docker-compose down 2>$null
            Set-Location $env:USERPROFILE
            Remove-Item $InstallDir -Recurse -Force
        }
        
        Write-ColorOutput "Maintrix désinstallé avec succès" "Success"
    }
    catch {
        Write-ColorOutput "Erreur lors de la désinstallation: $($_.Exception.Message)" "Error"
    }
}

# =================================
# GESTION DES PARAMÈTRES
# =================================
if ($Help) {
    Write-Host @"
MAINTRIX - Installation Windows PowerShell

UTILISATION:
    .\install-maintrix.ps1 [OPTIONS]

OPTIONS:
    -WebPort <port>         Port web pour Maintrix (défaut: 8080)
    -DomainName <domain>    Nom de domaine optionnel
    -DbPassword <password>  Mot de passe base de données personnalisé
    -InstallDir <path>      Répertoire d'installation (défaut: C:\Maintrix)
    -SkipWSL               Ignorer l'installation WSL2
    -Verbose               Affichage détaillé
    -Help                  Afficher cette aide
    -Version               Afficher la version
    -Uninstall             Désinstaller Maintrix

EXEMPLES:
    .\install-maintrix.ps1
    .\install-maintrix.ps1 -WebPort 9000 -DomainName maintrix.local
    .\install-maintrix.ps1 -Uninstall

PRÉREQUIS:
    - Windows 10/11 avec WSL2
    - Docker Desktop
    - Droits d'administrateur
"@
    exit 0
}

if ($Version) {
    Write-Host "Maintrix Windows Installer v$MAINTRIX_VERSION"
    exit 0
}

if ($Uninstall) {
    Uninstall-Maintrix
    exit 0
}

# =================================
# FONCTION PRINCIPALE
# =================================
function Main {
    Write-Host ""
    Write-ColorOutput "🚀 MAINTRIX - Installation Windows" "Info"
    Write-ColorOutput "====================================" "Info"
    Write-Host ""
    
    # Vérifications initiales
    if (-not (Test-Administrator)) {
        Write-ColorOutput "Ce script doit être exécuté en tant qu'administrateur" "Error"
        Write-ColorOutput "Clic droit > Exécuter en tant qu'administrateur" "Info"
        exit 1
    }
    
    if (-not (Test-WindowsVersion)) {
        exit 1
    }
    
    if (-not (Test-SystemRequirements)) {
        exit 1
    }
    
    # Configuration interactive si pas de paramètres
    if ([string]::IsNullOrEmpty($WebPort) -or $WebPort -eq "8080") {
        $inputPort = Read-Host "Port web pour Maintrix (défaut: 8080)"
        if (![string]::IsNullOrEmpty($inputPort)) {
            $WebPort = $inputPort
        }
    }
    
    if ([string]::IsNullOrEmpty($DomainName)) {
        $DomainName = Read-Host "Nom de domaine (optionnel)"
    }
    
    if ([string]::IsNullOrEmpty($DbPassword)) {
        $securePassword = Read-Host "Mot de passe base de données (optionnel, généré automatiquement)" -AsSecureString
        if ($securePassword.Length -gt 0) {
            $DbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
        }
    }
    
    # Installation WSL2 et Ubuntu
    if (-not $SkipWSL) {
        if (-not (Install-WSL2)) {
            Write-ColorOutput "Installation WSL2 incomplète - redémarrage requis" "Warning"
            exit 2
        }
        
        if (-not (Install-UbuntuWSL)) {
            Write-ColorOutput "Installation Ubuntu échouée" "Error"
            exit 1
        }
    }
    
    # Installation Docker Desktop
    if (-not (Test-DockerRunning)) {
        if (-not (Install-DockerDesktop)) {
            Write-ColorOutput "Installation Docker Desktop incomplète - redémarrage requis" "Warning"
            exit 2
        }
    }
    
    # Configuration Maintrix
    if (-not (Initialize-MaintrixDirectories)) { exit 1 }
    New-SecurePasswords
    if (-not (New-EnvironmentFile)) { exit 1 }
    if (-not (Copy-MaintrixFiles)) { exit 1 }
    if (-not (New-ManagementScripts)) { exit 1 }
    
    # Démarrage des services
    if (-not (Start-MaintrixServices)) {
        Write-ColorOutput "Erreur lors du démarrage des services" "Error"
        exit 1
    }
    
    # Vérifications finales
    if (Test-MaintrixInstallation) {
        Show-InstallationReport
    }
    else {
        Write-ColorOutput "L'installation s'est terminée avec des avertissements" "Warning"
        Write-ColorOutput "Consultez les logs: docker-compose logs" "Info"
    }
}

# =================================
# EXÉCUTION
# =================================
try {
    Main
}
catch {
    Write-ColorOutput "Erreur critique: $($_.Exception.Message)" "Error"
    exit 1
}