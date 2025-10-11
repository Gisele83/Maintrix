# Script de création VM Maintrix avec Hyper-V (Alternative à Vagrant)
# Exécuter en tant qu'Administrateur

param(
    [string]$VMName = "Maintrix-Server",
    [string]$VMPath = "C:\Hyper-V\VMs",
    [int]$MemoryGB = 4,
    [int]$CPUs = 2,
    [string]$ISOPath = ""
)

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      Création VM Maintrix avec Hyper-V                    ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Vérifier les privilèges administrateur
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "✗ Ce script doit être exécuté en tant qu'Administrateur" -ForegroundColor Red
    exit 1
}

# Vérifier si Hyper-V est activé
Write-Host "`n[1/8] Vérification Hyper-V..." -ForegroundColor Yellow
$hyperv = Get-WindowsOptionalFeature -FeatureName Microsoft-Hyper-V-All -Online

if ($hyperv.State -ne "Enabled") {
    Write-Host "⚠ Hyper-V n'est pas activé. Activation en cours..." -ForegroundColor Yellow
    Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -NoRestart
    Write-Host "✓ Hyper-V activé (redémarrage requis)" -ForegroundColor Green
    Write-Host "⚠ Veuillez redémarrer Windows et relancer ce script" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "✓ Hyper-V est activé" -ForegroundColor Green
}

# Créer le dossier de la VM
Write-Host "`n[2/8] Création du dossier VM..." -ForegroundColor Yellow
if (!(Test-Path $VMPath)) {
    New-Item -ItemType Directory -Path $VMPath -Force | Out-Null
    Write-Host "✓ Dossier créé: $VMPath" -ForegroundColor Green
} else {
    Write-Host "✓ Dossier existe: $VMPath" -ForegroundColor Green
}

# Vérifier si la VM existe déjà
Write-Host "`n[3/8] Vérification VM existante..." -ForegroundColor Yellow
$existingVM = Get-VM -Name $VMName -ErrorAction SilentlyContinue

if ($existingVM) {
    Write-Host "⚠ La VM '$VMName' existe déjà" -ForegroundColor Yellow
    $response = Read-Host "Voulez-vous la supprimer et recréer? (O/N)"
    
    if ($response -eq "O" -or $response -eq "o") {
        Stop-VM -Name $VMName -Force -ErrorAction SilentlyContinue
        Remove-VM -Name $VMName -Force
        Write-Host "✓ VM existante supprimée" -ForegroundColor Green
    } else {
        Write-Host "✗ Annulation" -ForegroundColor Red
        exit 0
    }
}

# Créer le disque virtuel
Write-Host "`n[4/8] Création du disque virtuel (60 GB)..." -ForegroundColor Yellow
$VHDPath = "$VMPath\$VMName\$VMName.vhdx"
$VHDSize = 60GB

if (!(Test-Path "$VMPath\$VMName")) {
    New-Item -ItemType Directory -Path "$VMPath\$VMName" -Force | Out-Null
}

New-VHD -Path $VHDPath -SizeBytes $VHDSize -Dynamic | Out-Null
Write-Host "✓ Disque créé: $VHDPath" -ForegroundColor Green

# Créer le commutateur virtuel (si nécessaire)
Write-Host "`n[5/8] Configuration réseau..." -ForegroundColor Yellow
$switchName = "MaintrixSwitch"
$existingSwitch = Get-VMSwitch -Name $switchName -ErrorAction SilentlyContinue

if (!$existingSwitch) {
    # Créer un commutateur externe (utilise la carte réseau de l'hôte)
    $netAdapter = Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Select-Object -First 1
    
    if ($netAdapter) {
        New-VMSwitch -Name $switchName -NetAdapterName $netAdapter.Name -AllowManagementOS $true | Out-Null
        Write-Host "✓ Commutateur réseau créé: $switchName" -ForegroundColor Green
    } else {
        # Créer un commutateur interne si pas de carte réseau
        New-VMSwitch -Name $switchName -SwitchType Internal | Out-Null
        Write-Host "✓ Commutateur interne créé: $switchName" -ForegroundColor Green
    }
} else {
    Write-Host "✓ Commutateur réseau existant: $switchName" -ForegroundColor Green
}

# Créer la VM
Write-Host "`n[6/8] Création de la machine virtuelle..." -ForegroundColor Yellow
$MemoryBytes = $MemoryGB * 1GB

New-VM -Name $VMName `
    -MemoryStartupBytes $MemoryBytes `
    -Generation 2 `
    -VHDPath $VHDPath `
    -Path $VMPath `
    -SwitchName $switchName | Out-Null

# Configurer la VM
Set-VM -Name $VMName -ProcessorCount $CPUs -DynamicMemory -MemoryMinimumBytes 2GB -MemoryMaximumBytes 8GB
Set-VMProcessor -VMName $VMName -ExposeVirtualizationExtensions $true
Write-Host "✓ VM créée et configurée" -ForegroundColor Green

# Configurer le boot (si ISO fournie)
if ($ISOPath -and (Test-Path $ISOPath)) {
    Write-Host "`n[7/8] Configuration ISO de boot..." -ForegroundColor Yellow
    Add-VMDvdDrive -VMName $VMName -Path $ISOPath
    $dvd = Get-VMDvdDrive -VMName $VMName
    Set-VMFirmware -VMName $VMName -FirstBootDevice $dvd
    Write-Host "✓ ISO montée: $ISOPath" -ForegroundColor Green
} else {
    Write-Host "`n[7/8] Pas d'ISO fournie (installation manuelle requise)" -ForegroundColor Yellow
}

# Afficher le résumé
Write-Host "`n[8/8] Configuration terminée!" -ForegroundColor Green

Write-Host "`n╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✓ VM MAINTRIX CRÉÉE                         ║" -ForegroundColor Green
Write-Host "╟───────────────────────────────────────────────────────────╢" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "║  Nom:           $VMName                                   ║" -ForegroundColor Green
Write-Host "║  Mémoire:       $MemoryGB GB                              ║" -ForegroundColor Green
Write-Host "║  Processeurs:   $CPUs                                     ║" -ForegroundColor Green
Write-Host "║  Disque:        60 GB                                     ║" -ForegroundColor Green
Write-Host "║  Réseau:        $switchName                               ║" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "║  Démarrer:      Start-VM -Name $VMName                    ║" -ForegroundColor Green
Write-Host "║  Connecter:     vmconnect localhost $VMName               ║" -ForegroundColor Green
Write-Host "║  Arrêter:       Stop-VM -Name $VMName                     ║" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "║  PROCHAINES ÉTAPES:                                       ║" -ForegroundColor Green
Write-Host "║  1. Installer Windows Server dans la VM                   ║" -ForegroundColor Green
Write-Host "║  2. Copier le dossier Maintrix dans C:\maintrix           ║" -ForegroundColor Green
Write-Host "║  3. Exécuter vm-setup-windows.ps1 dans la VM              ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green

# Proposer de démarrer la VM
$start = Read-Host "`nVoulez-vous démarrer la VM maintenant? (O/N)"
if ($start -eq "O" -or $start -eq "o") {
    Start-VM -Name $VMName
    Write-Host "✓ VM démarrée" -ForegroundColor Green
    
    # Ouvrir la console VM
    vmconnect localhost $VMName
}
