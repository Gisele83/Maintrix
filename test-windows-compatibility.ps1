# 🧪 Maintrix Windows - Test de Compatibilité
# Vérification complète de la compatibilité Windows pour Maintrix

param(
    [switch]$Detailed,
    [switch]$Fix,
    [switch]$Report,
    [string]$ReportPath = "",
    [switch]$Silent
)

# =================================
# VARIABLES GLOBALES
# =================================
$REQUIRED_WINDOWS_BUILD = 19041
$REQUIRED_MEMORY_GB = 4
$REQUIRED_DISK_GB = 20
$REQUIRED_DOCKER_VERSION = "20.10.0"

$testResults = @{}
$warnings = @()
$errors = @()
$fixesApplied = @()

# =================================
# FONCTIONS UTILITAIRES
# =================================
function Write-ColorOutput {
    param([string]$Message, [string]$Type = "Info")
    if (-not $Silent) {
        switch ($Type) {
            "Success" { Write-Host "✅ $Message" -ForegroundColor Green }
            "Error"   { Write-Host "❌ $Message" -ForegroundColor Red }
            "Warning" { Write-Host "⚠️  $Message" -ForegroundColor Yellow }
            "Info"    { Write-Host "ℹ️  $Message" -ForegroundColor Blue }
            "Test"    { Write-Host "🧪 $Message" -ForegroundColor Cyan }
            "Fix"     { Write-Host "🔧 $Message" -ForegroundColor Magenta }
        }
    }
}

function Add-TestResult {
    param([string]$TestName, [bool]$Passed, [string]$Message, [string]$Details = "", [string]$FixAction = "")
    
    $testResults[$TestName] = @{
        Passed = $Passed
        Message = $Message
        Details = $Details
        FixAction = $FixAction
    }
    
    if ($Passed) {
        Write-ColorOutput "$TestName : $Message" "Success"
    } else {
        Write-ColorOutput "$TestName : $Message" "Error"
        $errors += "$TestName : $Message"
    }
    
    if ($Details -and $Detailed) {
        Write-ColorOutput "   Détails: $Details" "Info"
    }
}

function Add-Warning {
    param([string]$Message)
    $warnings += $Message
    Write-ColorOutput $Message "Warning"
}

# =================================
# TESTS DE COMPATIBILITÉ
# =================================
function Test-WindowsVersion {
    Write-ColorOutput "Test de la version Windows..." "Test"
    
    try {
        $osInfo = Get-CimInstance Win32_OperatingSystem
        $version = [System.Environment]::OSVersion.Version
        $build = $version.Build
        
        $passed = $build -ge $REQUIRED_WINDOWS_BUILD
        
        $details = "Version: $($osInfo.Caption), Build: $build, Version: $($version.ToString())"
        $fixAction = if (-not $passed) { "Mettre à jour Windows vers la version 20H1 (build 19041) ou supérieure" } else { "" }
        
        Add-TestResult "Version Windows" $passed "Build $build $(if($passed){'(Compatible)'}else{'(Incompatible - Requis: ' + $REQUIRED_WINDOWS_BUILD + ')'})" $details $fixAction
        
        return $passed
    }
    catch {
        Add-TestResult "Version Windows" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

function Test-SystemArchitecture {
    Write-ColorOutput "Test de l'architecture système..." "Test"
    
    try {
        $arch = $env:PROCESSOR_ARCHITECTURE
        $is64Bit = [Environment]::Is64BitOperatingSystem
        
        $passed = $is64Bit -and ($arch -eq "AMD64" -or $arch -eq "ARM64")
        
        $details = "Architecture: $arch, 64-bit: $is64Bit"
        $fixAction = if (-not $passed) { "Maintrix nécessite un système Windows 64-bit" } else { "" }
        
        Add-TestResult "Architecture Système" $passed "$(if($passed){'64-bit supporté'}else{'Architecture non supportée'})" $details $fixAction
        
        return $passed
    }
    catch {
        Add-TestResult "Architecture Système" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

function Test-MemoryRequirements {
    Write-ColorOutput "Test de la mémoire RAM..." "Test"
    
    try {
        $totalMemory = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum
        $memoryGB = [math]::Round($totalMemory / 1GB, 2)
        
        $passed = $memoryGB -ge $REQUIRED_MEMORY_GB
        
        $details = "RAM installée: $memoryGB GB"
        $fixAction = if (-not $passed) { "Ajouter de la RAM pour atteindre minimum $REQUIRED_MEMORY_GB GB" } else { "" }
        
        Add-TestResult "Mémoire RAM" $passed "$memoryGB GB $(if($passed){'(Suffisante)'}else{'(Insuffisante - Requis: ' + $REQUIRED_MEMORY_GB + ' GB)'})" $details $fixAction
        
        if ($memoryGB -lt 8) {
            Add-Warning "Bien que $memoryGB GB soit suffisant, 8 GB ou plus est recommandé pour de meilleures performances"
        }
        
        return $passed
    }
    catch {
        Add-TestResult "Mémoire RAM" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

function Test-DiskSpace {
    Write-ColorOutput "Test de l'espace disque..." "Test"
    
    try {
        $diskSpace = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'" | 
                     Select-Object @{Name="FreeSpaceGB";Expression={[math]::Round($_.FreeSpace/1GB,2)}}
        
        $freeSpaceGB = $diskSpace.FreeSpaceGB
        $passed = $freeSpaceGB -ge $REQUIRED_DISK_GB
        
        $details = "Espace libre sur C: : $freeSpaceGB GB"
        $fixAction = if (-not $passed) { "Libérer de l'espace disque pour avoir au moins $REQUIRED_DISK_GB GB" } else { "" }
        
        Add-TestResult "Espace Disque" $passed "$freeSpaceGB GB libre $(if($passed){'(Suffisant)'}else{'(Insuffisant - Requis: ' + $REQUIRED_DISK_GB + ' GB)'})" $details $fixAction
        
        if ($freeSpaceGB -lt 50) {
            Add-Warning "Bien que $freeSpaceGB GB soit suffisant, 50 GB ou plus est recommandé"
        }
        
        return $passed
    }
    catch {
        Add-TestResult "Espace Disque" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

function Test-VirtualizationSupport {
    Write-ColorOutput "Test du support de virtualisation..." "Test"
    
    try {
        # Vérification Hyper-V capability
        $hyperVSupport = Get-CimInstance -ClassName Win32_Processor | Select-Object -ExpandProperty VirtualizationFirmwareEnabled
        
        # Vérification des fonctionnalités Windows
        $vmPlatform = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -ErrorAction SilentlyContinue
        $wslFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -ErrorAction SilentlyContinue
        
        $virtualizationEnabled = $hyperVSupport -contains $true
        $vmPlatformAvailable = $vmPlatform -ne $null
        $wslAvailable = $wslFeature -ne $null
        
        $passed = $virtualizationEnabled -and $vmPlatformAvailable -and $wslAvailable
        
        $details = "Virtualisation firmware: $virtualizationEnabled, VM Platform: $($vmPlatform.State), WSL: $($wslFeature.State)"
        $fixAction = if (-not $passed) { "Activer la virtualisation dans le BIOS/UEFI et installer les fonctionnalités Windows requises" } else { "" }
        
        Add-TestResult "Support Virtualisation" $passed "$(if($passed){'Virtualisation supportée'}else{'Problème de virtualisation'})" $details $fixAction
        
        return $passed
    }
    catch {
        Add-TestResult "Support Virtualisation" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

function Test-WSL2Installation {
    Write-ColorOutput "Test de l'installation WSL2..." "Test"
    
    try {
        # Vérification de la commande WSL
        $wslVersion = wsl --version 2>$null
        $wslInstalled = $LASTEXITCODE -eq 0
        
        if ($wslInstalled) {
            # Vérification des distributions WSL
            $distros = wsl -l -v 2>$null
            $hasWSL2Distro = $distros -match "Version 2"
            
            $passed = $wslInstalled -and $hasWSL2Distro
            $details = "WSL installé: $wslInstalled, Distributions WSL2: $hasWSL2Distro"
            $fixAction = if (-not $passed) { "Installer WSL2 et une distribution Linux (Ubuntu recommandé)" } else { "" }
            
            Add-TestResult "WSL2" $passed "$(if($passed){'WSL2 installé et configuré'}else{'WSL2 incomplet'})" $details $fixAction
        } else {
            $passed = $false
            $details = "WSL non installé"
            $fixAction = "Installer WSL2 avec: wsl --install"
            
            Add-TestResult "WSL2" $passed "WSL non installé" $details $fixAction
        }
        
        return $passed
    }
    catch {
        Add-TestResult "WSL2" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

function Test-DockerInstallation {
    Write-ColorOutput "Test de l'installation Docker..." "Test"
    
    try {
        # Vérification de Docker
        $dockerVersion = docker --version 2>$null
        $dockerInstalled = $LASTEXITCODE -eq 0
        
        if ($dockerInstalled) {
            # Extraction de la version
            $versionMatch = [regex]::Match($dockerVersion, "(\d+\.\d+\.\d+)")
            if ($versionMatch.Success) {
                $currentVersion = [Version]$versionMatch.Groups[1].Value
                $requiredVersion = [Version]$REQUIRED_DOCKER_VERSION
                $versionOK = $currentVersion -ge $requiredVersion
            } else {
                $versionOK = $true  # Si on ne peut pas parser, on assume que c'est OK
            }
            
            # Vérification de Docker Compose
            $composeVersion = docker-compose --version 2>$null
            $composeInstalled = $LASTEXITCODE -eq 0
            
            $passed = $dockerInstalled -and $versionOK -and $composeInstalled
            $details = "Docker: $dockerVersion, Docker Compose: $($composeInstalled -and $composeVersion)"
            $fixAction = if (-not $passed) { "Installer Docker Desktop pour Windows avec support WSL2" } else { "" }
            
            Add-TestResult "Docker" $passed "$(if($passed){'Docker et Compose installés'}else{'Problème Docker'})" $details $fixAction
        } else {
            $passed = $false
            $details = "Docker non installé"
            $fixAction = "Installer Docker Desktop pour Windows"
            
            Add-TestResult "Docker" $passed "Docker non installé" $details $fixAction
        }
        
        return $passed
    }
    catch {
        Add-TestResult "Docker" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

function Test-DockerServiceStatus {
    Write-ColorOutput "Test du statut du service Docker..." "Test"
    
    try {
        # Vérification du service Docker
        $dockerService = Get-Service "com.docker.service" -ErrorAction SilentlyContinue
        $serviceRunning = $dockerService -and $dockerService.Status -eq "Running"
        
        # Test de connectivité Docker
        $dockerInfo = docker info 2>$null
        $dockerResponsive = $LASTEXITCODE -eq 0
        
        $passed = $serviceRunning -and $dockerResponsive
        $details = "Service Docker: $($dockerService.Status), Docker responsif: $dockerResponsive"
        $fixAction = if (-not $passed) { "Démarrer Docker Desktop ou redémarrer le service Docker" } else { "" }
        
        Add-TestResult "Service Docker" $passed "$(if($passed){'Docker service actif'}else{'Problème service Docker'})" $details $fixAction
        
        return $passed
    }
    catch {
        Add-TestResult "Service Docker" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

function Test-NetworkConnectivity {
    Write-ColorOutput "Test de la connectivité réseau..." "Test"
    
    try {
        # Test de connectivité Internet
        $internetTest = Test-NetConnection -ComputerName "8.8.8.8" -Port 53 -InformationLevel Quiet -WarningAction SilentlyContinue
        
        # Test des ports locaux
        $localPortTests = @()
        $testPorts = @(8080, 5433, 80, 443)
        
        foreach ($port in $testPorts) {
            $portAvailable = -not (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue)
            $localPortTests += "$port:$(if($portAvailable){'Libre'}else{'Occupé'})"
        }
        
        $passed = $internetTest
        $details = "Internet: $internetTest, Ports: $($localPortTests -join ', ')"
        $fixAction = if (-not $passed) { "Vérifier la connectivité Internet et les paramètres de pare-feu" } else { "" }
        
        Add-TestResult "Connectivité Réseau" $passed "$(if($passed){'Réseau OK'}else{'Problème réseau'})" $details $fixAction
        
        # Avertissement pour les ports occupés
        if ($localPortTests -match "Occupé") {
            Add-Warning "Certains ports sont occupés - cela peut causer des conflits"
        }
        
        return $passed
    }
    catch {
        Add-TestResult "Connectivité Réseau" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

function Test-PowerShellVersion {
    Write-ColorOutput "Test de la version PowerShell..." "Test"
    
    try {
        $psVersion = $PSVersionTable.PSVersion
        $passed = $psVersion.Major -ge 5
        
        $details = "Version PowerShell: $($psVersion.ToString())"
        $fixAction = if (-not $passed) { "Mettre à jour PowerShell vers la version 5.0 ou supérieure" } else { "" }
        
        Add-TestResult "PowerShell" $passed "Version $($psVersion.ToString()) $(if($passed){'(Compatible)'}else{'(Incompatible)'})" $details $fixAction
        
        if ($psVersion.Major -lt 7) {
            Add-Warning "PowerShell 7+ est recommandé pour de meilleures performances"
        }
        
        return $passed
    }
    catch {
        Add-TestResult "PowerShell" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

function Test-WindowsFeatures {
    Write-ColorOutput "Test des fonctionnalités Windows..." "Test"
    
    try {
        $requiredFeatures = @(
            "VirtualMachinePlatform",
            "Microsoft-Windows-Subsystem-Linux"
        )
        
        $featureStatus = @()
        $allEnabled = $true
        
        foreach ($feature in $requiredFeatures) {
            $featureInfo = Get-WindowsOptionalFeature -Online -FeatureName $feature -ErrorAction SilentlyContinue
            if ($featureInfo) {
                $enabled = $featureInfo.State -eq "Enabled"
                $featureStatus += "$feature`:$($featureInfo.State)"
                if (-not $enabled) { $allEnabled = $false }
            } else {
                $featureStatus += "$feature`:NotFound"
                $allEnabled = $false
            }
        }
        
        $passed = $allEnabled
        $details = $featureStatus -join ", "
        $fixAction = if (-not $passed) { "Activer les fonctionnalités Windows: " + ($requiredFeatures -join ", ") } else { "" }
        
        Add-TestResult "Fonctionnalités Windows" $passed "$(if($passed){'Toutes activées'}else{'Fonctionnalités manquantes'})" $details $fixAction
        
        return $passed
    }
    catch {
        Add-TestResult "Fonctionnalités Windows" $false "Erreur lors de la vérification" $_.Exception.Message ""
        return $false
    }
}

# =================================
# FONCTIONS DE CORRECTION
# =================================
function Fix-WindowsFeatures {
    Write-ColorOutput "Correction des fonctionnalités Windows..." "Fix"
    
    try {
        Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
        Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
        
        $fixesApplied += "Fonctionnalités Windows activées"
        Write-ColorOutput "Fonctionnalités Windows activées (redémarrage requis)" "Success"
        return $true
    }
    catch {
        Write-ColorOutput "Erreur lors de l'activation des fonctionnalités: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Fix-WSL2 {
    Write-ColorOutput "Installation/Correction de WSL2..." "Fix"
    
    try {
        # Installation WSL2
        wsl --install --no-launch
        
        # Configuration version par défaut
        wsl --set-default-version 2
        
        $fixesApplied += "WSL2 installé"
        Write-ColorOutput "WSL2 installé (redémarrage requis)" "Success"
        return $true
    }
    catch {
        Write-ColorOutput "Erreur lors de l'installation WSL2: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Fix-DockerDesktop {
    Write-ColorOutput "Installation de Docker Desktop..." "Fix"
    
    try {
        $dockerUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
        $installerPath = "$env:TEMP\DockerDesktopInstaller.exe"
        
        Write-ColorOutput "Téléchargement de Docker Desktop..." "Info"
        Invoke-WebRequest -Uri $dockerUrl -OutFile $installerPath
        
        Write-ColorOutput "Installation de Docker Desktop..." "Info"
        Start-Process $installerPath -Wait -ArgumentList "install --quiet --accept-license --backend=wsl-2"
        
        $fixesApplied += "Docker Desktop installé"
        Write-ColorOutput "Docker Desktop installé (redémarrage requis)" "Success"
        return $true
    }
    catch {
        Write-ColorOutput "Erreur lors de l'installation Docker Desktop: $($_.Exception.Message)" "Error"
        return $false
    }
}

# =================================
# GÉNÉRATION DE RAPPORT
# =================================
function Generate-Report {
    $reportContent = @"
# RAPPORT DE COMPATIBILITÉ MAINTRIX WINDOWS
Généré le: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Système: $(hostname)

## RÉSUMÉ EXÉCUTIF
Tests réussis: $($testResults.Values | Where-Object {$_.Passed} | Measure-Object | Select-Object -ExpandProperty Count)/$($testResults.Count)
Avertissements: $($warnings.Count)
Erreurs: $($errors.Count)

## DÉTAILS DES TESTS
"@

    foreach ($testName in $testResults.Keys) {
        $result = $testResults[$testName]
        $status = if ($result.Passed) { "✅ RÉUSSI" } else { "❌ ÉCHOUÉ" }
        
        $reportContent += @"

### $testName
**Statut**: $status
**Message**: $($result.Message)
**Détails**: $($result.Details)
"@
        
        if ($result.FixAction) {
            $reportContent += @"
**Action corrective**: $($result.FixAction)
"@
        }
    }

    if ($warnings.Count -gt 0) {
        $reportContent += @"

## AVERTISSEMENTS
"@
        foreach ($warning in $warnings) {
            $reportContent += "- $warning`n"
        }
    }

    if ($errors.Count -gt 0) {
        $reportContent += @"

## ERREURS
"@
        foreach ($error in $errors) {
            $reportContent += "- $error`n"
        }
    }

    if ($fixesApplied.Count -gt 0) {
        $reportContent += @"

## CORRECTIONS APPLIQUÉES
"@
        foreach ($fix in $fixesApplied) {
            $reportContent += "- $fix`n"
        }
    }

    $reportContent += @"

## RECOMMANDATIONS
1. Corriger tous les tests échoués avant d'installer Maintrix
2. Redémarrer le système après les corrections
3. Réexécuter ce test après redémarrage
4. Installer Maintrix avec le script PowerShell d'installation

## RESSOURCES
- Documentation Windows: INSTALLATION_WINDOWS_GUIDE.md
- Script d'installation: install-maintrix.ps1
- Support: support-windows@maintrix-t.com
"@

    if ([string]::IsNullOrEmpty($ReportPath)) {
        $ReportPath = "maintrix_compatibility_report_$(Get-Date -Format 'yyyyMMdd_HHmmss').md"
    }

    $reportContent | Out-File $ReportPath -Encoding UTF8
    Write-ColorOutput "Rapport généré: $ReportPath" "Success"
}

# =================================
# FONCTION PRINCIPALE
# =================================
function Main {
    Write-Host ""
    Write-ColorOutput "🧪 MAINTRIX - TEST DE COMPATIBILITÉ WINDOWS" "Info"
    Write-ColorOutput "================================================" "Info"
    Write-Host ""
    
    # Vérification des privilèges administrateur
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$currentUser
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if (-not $isAdmin) {
        Write-ColorOutput "Tests avancés nécessitent des privilèges administrateur" "Warning"
        Add-Warning "Certains tests peuvent être incomplets sans privilèges administrateur"
    }
    
    # Exécution des tests
    $testsPassed = 0
    $totalTests = 0
    
    $totalTests++; if (Test-WindowsVersion) { $testsPassed++ }
    $totalTests++; if (Test-SystemArchitecture) { $testsPassed++ }
    $totalTests++; if (Test-MemoryRequirements) { $testsPassed++ }
    $totalTests++; if (Test-DiskSpace) { $testsPassed++ }
    $totalTests++; if (Test-PowerShellVersion) { $testsPassed++ }
    
    if ($isAdmin) {
        $totalTests++; if (Test-VirtualizationSupport) { $testsPassed++ }
        $totalTests++; if (Test-WindowsFeatures) { $testsPassed++ }
    }
    
    $totalTests++; if (Test-WSL2Installation) { $testsPassed++ }
    $totalTests++; if (Test-DockerInstallation) { $testsPassed++ }
    $totalTests++; if (Test-DockerServiceStatus) { $testsPassed++ }
    $totalTests++; if (Test-NetworkConnectivity) { $testsPassed++ }
    
    # Application des corrections si demandé
    if ($Fix -and $isAdmin) {
        Write-Host ""
        Write-ColorOutput "Application des corrections automatiques..." "Fix"
        
        if ($testResults["Fonctionnalités Windows"] -and -not $testResults["Fonctionnalités Windows"].Passed) {
            Fix-WindowsFeatures
        }
        
        if ($testResults["WSL2"] -and -not $testResults["WSL2"].Passed) {
            Fix-WSL2
        }
        
        if ($testResults["Docker"] -and -not $testResults["Docker"].Passed) {
            Fix-DockerDesktop
        }
    } elseif ($Fix -and -not $isAdmin) {
        Write-ColorOutput "Corrections automatiques nécessitent des privilèges administrateur" "Error"
    }
    
    # Résultats finaux
    Write-Host ""
    Write-ColorOutput "================================================" "Info"
    Write-ColorOutput "RÉSULTATS DES TESTS" "Info"
    Write-ColorOutput "================================================" "Info"
    
    $compatibilityPercent = [math]::Round(($testsPassed / $totalTests) * 100, 1)
    
    if ($testsPassed -eq $totalTests) {
        Write-ColorOutput "✅ SYSTÈME COMPATIBLE - $testsPassed/$totalTests tests réussis ($compatibilityPercent%)" "Success"
        Write-ColorOutput "Vous pouvez procéder à l'installation de Maintrix" "Success"
    } elseif ($compatibilityPercent -ge 80) {
        Write-ColorOutput "⚠️  SYSTÈME PARTIELLEMENT COMPATIBLE - $testsPassed/$totalTests tests réussis ($compatibilityPercent%)" "Warning"
        Write-ColorOutput "Installation possible avec corrections mineures" "Warning"
    } else {
        Write-ColorOutput "❌ SYSTÈME INCOMPATIBLE - $testsPassed/$totalTests tests réussis ($compatibilityPercent%)" "Error"
        Write-ColorOutput "Corrections importantes requises avant installation" "Error"
    }
    
    if ($warnings.Count -gt 0) {
        Write-ColorOutput "$($warnings.Count) avertissement(s) détecté(s)" "Warning"
    }
    
    if ($errors.Count -gt 0) {
        Write-ColorOutput "$($errors.Count) erreur(s) critique(s) détectée(s)" "Error"
    }
    
    # Génération du rapport
    if ($Report) {
        Generate-Report
    }
    
    # Conseils de suite
    Write-Host ""
    Write-ColorOutput "PROCHAINES ÉTAPES:" "Info"
    
    if ($testsPassed -eq $totalTests) {
        Write-ColorOutput "1. Exécuter: .\install-maintrix.ps1" "Info"
        Write-ColorOutput "2. Suivre le guide: INSTALLATION_WINDOWS_GUIDE.md" "Info"
    } else {
        Write-ColorOutput "1. Corriger les problèmes identifiés" "Info"
        Write-ColorOutput "2. Redémarrer le système si nécessaire" "Info"
        Write-ColorOutput "3. Réexécuter ce test: .\test-windows-compatibility.ps1" "Info"
        Write-ColorOutput "4. Une fois compatible, installer: .\install-maintrix.ps1" "Info"
    }
    
    if ($Fix -and $fixesApplied.Count -gt 0) {
        Write-ColorOutput "⚠️  REDÉMARRAGE REQUIS pour appliquer les corrections" "Warning"
    }
    
    return $compatibilityPercent -eq 100
}

# =================================
# GESTION DES PARAMÈTRES
# =================================
if ($args -contains "--help" -or $args -contains "-h") {
    Write-Host @"
MAINTRIX WINDOWS COMPATIBILITY TEST

UTILISATION:
    .\test-windows-compatibility.ps1 [OPTIONS]

OPTIONS:
    -Detailed          Affichage détaillé des résultats
    -Fix               Appliquer les corrections automatiques (nécessite admin)
    -Report            Générer un rapport de compatibilité
    -ReportPath <path> Chemin du rapport de compatibilité
    -Silent            Mode silencieux (minimal output)

EXEMPLES:
    .\test-windows-compatibility.ps1
    .\test-windows-compatibility.ps1 -Detailed -Report
    .\test-windows-compatibility.ps1 -Fix -Report

NOTES:
    - Exécuter en tant qu'administrateur pour des tests complets
    - Certaines corrections nécessitent un redémarrage
    - Le rapport est généré en format Markdown
"@
    exit 0
}

# =================================
# EXÉCUTION
# =================================
try {
    $compatible = Main
    exit $(if ($compatible) { 0 } else { 1 })
}
catch {
    Write-ColorOutput "Erreur critique: $($_.Exception.Message)" "Error"
    exit 2
}